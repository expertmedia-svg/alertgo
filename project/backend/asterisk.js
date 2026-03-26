// ============================================================
// asterisk.js — Interface Asterisk AMI + serveur AGI
// ============================================================
const net    = require('net');
const events = require('events');
const db     = require('./db');

// ── CONFIG AMI ────────────────────────────────────────────────
const AMI_HOST   = process.env.AMI_HOST   || '127.0.0.1';
const AMI_PORT   = parseInt(process.env.AMI_PORT)  || 5038;
const AMI_USER   = process.env.AMI_USER   || 'alertadmin';
const AMI_SECRET = process.env.AMI_SECRET || 'alertpass123';

// ── CONFIG AGI ────────────────────────────────────────────────
const AGI_PORT   = parseInt(process.env.AGI_PORT)  || 4573;

// ── DONGLE disponibles (round-robin) ──────────────────────────
const DONGLES   = (process.env.DONGLES || 'dongle0,dongle1').split(',');
let   dongleIdx = 0;
function nextDongle() {
  const d = DONGLES[dongleIdx % DONGLES.length];
  dongleIdx++;
  return d;
}

// ═════════════════════════════════════════════════════════════
// AMI CLIENT
// ═════════════════════════════════════════════════════════════
class AmiClient extends events.EventEmitter {
  constructor() {
    super();
    this.socket   = null;
    this.buffer   = '';
    this.actions  = {};
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(AMI_PORT, AMI_HOST);

      this.socket.on('connect', () => {
        console.log('[AMI] Connecté à Asterisk');
      });

      this.socket.on('data', (data) => {
        this.buffer += data.toString();
        const blocks = this.buffer.split('\r\n\r\n');
        this.buffer = blocks.pop(); // garder le fragment incomplet

        blocks.forEach(block => {
          const msg = this._parse(block);
          if (msg.Response === 'Success' && msg.Message === 'Authentication accepted') {
            this.connected = true;
            console.log('[AMI] Authentifié');
            resolve(this);
          }
          if (msg.ActionID && this.actions[msg.ActionID]) {
            this.actions[msg.ActionID](msg);
            delete this.actions[msg.ActionID];
          }
          if (msg.Event) {
            this.emit('event', msg);
            this.emit(msg.Event, msg);
          }
        });
      });

      this.socket.on('error', (err) => {
        console.error('[AMI] Erreur:', err.message);
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        console.warn('[AMI] Connexion fermée — reconnexion dans 5s');
        setTimeout(() => this.connect().catch(console.error), 5000);
      });

      // Login
      this.socket.write(
        `Action: Login\r\nUsername: ${AMI_USER}\r\nSecret: ${AMI_SECRET}\r\n\r\n`
      );
    });
  }

  _parse(block) {
    const obj = {};
    block.split('\r\n').forEach(line => {
      const idx = line.indexOf(': ');
      if (idx !== -1) {
        obj[line.slice(0, idx)] = line.slice(idx + 2);
      }
    });
    return obj;
  }

  _action(obj) {
    return new Promise((resolve) => {
      const actionId = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      obj.ActionID  = actionId;
      this.actions[actionId] = resolve;
      let raw = '';
      Object.entries(obj).forEach(([k, v]) => { raw += `${k}: ${v}\r\n`; });
      raw += '\r\n';
      this.socket.write(raw);
    });
  }

  // Passer un appel sortant via dongle GSM
  originate({ phone, contactId, alertId, alertType, dongle }) {
    const channel  = `Dongle/${dongle || nextDongle()}/${phone}`;
    const variable = `CONTACT_ID=${contactId},ALERT_ID=${alertId},ALERT_TYPE=${alertType}`;
    return this._action({
      Action:   'Originate',
      Channel:  channel,
      Context:  'alert-outbound',
      Exten:    's',
      Priority: '1',
      Timeout:  '30000',   // 30 secondes
      CallerID: 'Alerte <0000>',
      Variable: variable,
      Async:    'true'
    });
  }

  // Envoyer SMS via dongle GSM
  sendSms({ phone, message, dongle }) {
    return this._action({
      Action:   'DongleSendSMS',
      Device:   dongle || nextDongle(),
      Number:   phone,
      Message:  message.slice(0, 160)  // Limite SMS à 160 caractères
    });
  }
}

// ═════════════════════════════════════════════════════════════
// SERVEUR AGI (Asyncronous Gateway Interface)
// Reçoit les callbacks depuis extensions.conf
// ═════════════════════════════════════════════════════════════
function startAgiServer(io) {
  const server = net.createServer((socket) => {
    let headersDone = false;
    let headers     = {};
    let buffer      = '';
    let command     = '';   // commande AGI reçue dans l'URL agi://.../<command>/<arg1>

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!headersDone) {
          if (line === '') {
            headersDone = true;
            // Extraire la commande depuis agi_network_script
            const script = headers['agi_network_script'] || '';
            const parts  = script.replace(/^\//, '').split('/');
            command      = parts[0];
            const arg1   = parts[1];

            handleAgiCommand(command, arg1, headers, socket, io);
          } else {
            const idx = line.indexOf(': ');
            if (idx !== -1) {
              headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 2);
            }
          }
        }
      }
    });

    socket.on('error', () => {});
  });

  server.listen(AGI_PORT, '127.0.0.1', () => {
    console.log(`[AGI] Serveur démarré sur le port ${AGI_PORT}`);
  });
}

function handleAgiCommand(command, arg1, headers, socket, io) {
  const contactId = headers['agi_variable_contact_id'] || arg1;
  const alertId   = headers['agi_variable_alert_id']   || '';

  switch (command) {
    case 'log_call_answered': {
      db.updateCall(contactId, { status: 'ANSWERED' });
      console.log(`[AGI] Appel décroché — contact:${contactId}`);
      io && io.emit('call_update', db.getMapData());
      break;
    }
    case 'record_response': {
      const response = headers['agi_variable_response'] || arg1;
      db.updateCall(contactId, { response, status: 'ANSWERED' });
      console.log(`[AGI] Réponse IVR — contact:${contactId} réponse:${response}`);
      io && io.emit('call_update', db.getMapData());
      io && io.emit('stats_update', db.getStats(alertId));
      break;
    }
    case 'log_call_failed': {
      const reason = headers['agi_variable_reason'] || arg1 || 'FAILED';
      db.updateCall(contactId, { status: reason });
      console.log(`[AGI] Appel échoué — contact:${contactId} raison:${reason}`);
      io && io.emit('call_update', db.getMapData());
      break;
    }
    default:
      console.warn('[AGI] Commande inconnue:', command);
  }

  // Répondre "200 result=0" pour libérer le canal AGI
  socket.write('VERBOSE "done" 1\n');
  socket.end('200 result=0\n');
}

// ═════════════════════════════════════════════════════════════
// Écouter les événements AMI pour détecter états appels
// ═════════════════════════════════════════════════════════════
function bindAmiEvents(ami, io) {
  ami.on('OriginateResponse', (evt) => {
    const vars     = evt.Variable || '';
    const contactId = (vars.match(/CONTACT_ID=([^,]+)/) || [])[1];
    const alertId   = (vars.match(/ALERT_ID=([^,]+)/)  || [])[1];
    if (!contactId) return;

    const reason = evt.Reason;
    let status = 'FAILED';
    if (reason === '4')  status = 'ANSWERED';
    else if (reason === '1') status = 'BUSY';
    else if (reason === '0') status = 'NOANSWER';

    db.updateCall(contactId, { status });
    io && io.emit('call_update', db.getMapData());
    io && io.emit('stats_update', db.getStats(alertId));
    console.log(`[AMI] OriginateResponse — contact:${contactId} status:${status}`);
  });
}

module.exports = { AmiClient, startAgiServer, bindAmiEvents, nextDongle };
