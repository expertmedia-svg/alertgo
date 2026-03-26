// ============================================================
// app.js — Serveur principal Express + Socket.IO
// ============================================================
const express    = require('express');
const http       = require('http');
const socketio   = require('socket.io');
const path       = require('path');
const cors       = require('cors');

const db         = require('./db');
const { AmiClient, startAgiServer, bindAmiEvents, nextDongle } = require('./asterisk');
const sms        = require('./sms');
const retry      = require('./retry');

const PORT = parseInt(process.env.PORT) || 3000;
const CALL_DELAY_MS = parseInt(process.env.CALL_DELAY_MS) || 3000;

// ── App ───────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new socketio.Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── AMI ───────────────────────────────────────────────────────
const ami = new AmiClient();

// ═════════════════════════════════════════════════════════════
// ROUTES API
// ═════════════════════════════════════════════════════════════

// ── Contacts ──────────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  res.json(db.getContacts());
});

app.post('/api/contacts', (req, res) => {
  const { name, phone, lat, lng, zone } = req.body;
  if (!name || !phone || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'name, phone, lat, lng requis' });
  }
  const contact = db.addContact({ name, phone, lat, lng, zone });
  res.status(201).json(contact);
});

// Bulk import contacts
app.post('/api/contacts/bulk', (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) return res.status(400).json({ error: 'contacts[] requis' });
  const created = contacts.map(c => db.addContact(c));
  res.status(201).json({ created: created.length, contacts: created });
});

// ── Alertes ───────────────────────────────────────────────────
app.get('/api/alerts', (req, res) => {
  res.json(db.getActiveAlerts());
});

// Déclencher une alerte → appels vers tous les contacts
app.post('/api/alerts', async (req, res) => {
  const { type, message, sendSmsAlso } = req.body;
  if (!type || !message) return res.status(400).json({ error: 'type et message requis' });

  const alert    = db.createAlert({ type, message });
  const contacts = db.getContacts();

  if (contacts.length === 0) {
    return res.status(400).json({ error: 'Aucun contact enregistré' });
  }

  res.status(202).json({ alert, total: contacts.length, message: 'Campagne lancée' });

  // Lancer les appels en arrière-plan
  setImmediate(async () => {
    console.log(`[ALERT] Campagne ${alert.id} — type:${type} — ${contacts.length} contacts`);

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const call    = db.createCallRecord({ contactId: contact.id, alertId: alert.id, alertType: type });

      db.updateCall(call.id, { status: 'CALLING', attempts: 1 });

      try {
        await ami.originate({
          phone:     contact.phone,
          contactId: call.id,
          alertId:   alert.id,
          alertType: type,
          dongle:    nextDongle()
        });
      } catch (err) {
        console.error(`[ALERT] Erreur originate ${contact.phone}: ${err.message}`);
        db.updateCall(call.id, { status: 'FAILED' });
      }

      io.emit('stats_update', db.getStats(alert.id));
      await new Promise(r => setTimeout(r, CALL_DELAY_MS));
    }

    // Envoi SMS si demandé
    if (sendSmsAlso) {
      console.log('[ALERT] Envoi SMS en cours...');
      await sms.sendAlertSms(contacts, type, message);
    }

    // Activer le scheduler de rappels
    retry.start();
  });
});

// ── Appels ────────────────────────────────────────────────────
app.get('/api/calls', (req, res) => {
  const { alertId } = req.query;
  res.json(db.getCalls(alertId));
});

app.get('/api/stats', (req, res) => {
  const { alertId } = req.query;
  res.json(db.getStats(alertId));
});

// ── Carte ─────────────────────────────────────────────────────
app.get('/api/map', (req, res) => {
  const { alertId } = req.query;
  res.json(db.getMapData(alertId));
});

// ── Rappels manuels ───────────────────────────────────────────
app.post('/api/retry', async (req, res) => {
  await retry.triggerNow();
  res.json({ message: 'Rappels lancés' });
});

// Rappeler un contact spécifique
app.post('/api/calls/:callId/retry', async (req, res) => {
  const call = db.getCalls().find(c => c.id === req.params.callId);
  if (!call) return res.status(404).json({ error: 'Appel non trouvé' });

  const contact = db.getContactById(call.contactId);
  if (!contact) return res.status(404).json({ error: 'Contact non trouvé' });

  db.updateCall(call.id, { status: 'CALLING', attempts: (call.attempts || 0) + 1 });

  await ami.originate({
    phone:     contact.phone,
    contactId: call.id,
    alertId:   call.alertId,
    alertType: call.alertType,
    dongle:    nextDongle()
  });

  res.json({ message: 'Rappel lancé', call: db.getCalls().find(c => c.id === call.id) });
});

// ── SMS manuel ────────────────────────────────────────────────
app.post('/api/sms', async (req, res) => {
  const { phone, message, dongle } = req.body;
  const result = await sms.sendSms({ phone, message, dongle });
  res.json(result);
});

// ═════════════════════════════════════════════════════════════
// SOCKET.IO temps réel
// ═════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log('[WS] Client connecté:', socket.id);
  // Envoyer l'état actuel à la connexion
  socket.emit('stats_update', db.getStats());
  socket.emit('call_update',  db.getMapData());
  socket.on('disconnect', () => console.log('[WS] Client déconnecté:', socket.id));
});

// ═════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═════════════════════════════════════════════════════════════
async function main() {
  console.log('=== Plateforme d\'alerte communautaire ===');

  // Démarrer le serveur AGI
  startAgiServer(io);

  // Connexion AMI
  try {
    await ami.connect();
    bindAmiEvents(ami, io);
    sms.setAmi(ami);
    retry.init(ami, io);
    console.log('[APP] AMI opérationnel');
  } catch (err) {
    console.error('[APP] Impossible de se connecter à AMI:', err.message);
    console.warn('[APP] Mode dégradé — les appels GSM seront désactivés');
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[APP] Serveur HTTP démarré → http://0.0.0.0:${PORT}`);
    console.log('[APP] Dashboard → http://localhost:' + PORT);
  });
}

main().catch(console.error);
