// ============================================================
// app.js — Serveur principal Express + Socket.IO
// ============================================================
const express    = require('express');
const http       = require('http');
const socketio   = require('socket.io');
const path       = require('path');
const cors       = require('cors');

const db         = require('./db');
const calls      = require('./calls');
const sms        = require('./sms');
const retry      = require('./retry');
const alertDetector = require('./alertDetector');
const alertAggregator = require('./alertAggregator');
const { AmiClient, startAgiServer, bindAmiEvents } = require('./asterisk');

const PORT = parseInt(process.env.PORT) || 3000;
const CALL_DELAY_MS = parseInt(process.env.CALL_DELAY_MS) || 3000;

// ── App ───────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new socketio.Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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
        await calls.originate({
          phone:     contact.phone,
          contactId: call.id,
          alertId:   alert.id,
          alertType: type,
          message:   message
        });
      } catch (err) {
        console.error(`[ALERT] Erreur appel ${contact.phone}: ${err.message}`);
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

  await calls.originate({
    phone:     contact.phone,
    contactId: call.id,
    alertId:   call.alertId,
    alertType: call.alertType,
    message:   db.getAlerts().find(a => a.id === call.alertId)?.message || 'Alerte'
  });

  res.json({ message: 'Rappel lancé', call: db.getCalls().find(c => c.id === call.id) });
});

// ── SMS manuel ────────────────────────────────────────────────
app.post('/api/sms', async (req, res) => {
  const { phone, message } = req.body;
  const result = await sms.sendSms({ phone, message });
  res.json(result);
});
// ══════════════════════════════════════════════════════════
// SYSTÈME DE DÉTECTION D'ALERTES PAR SMS
// ══════════════════════════════════════════════════════════

// ── Recevoir et analyser un SMS (webhook Twilio ou injection manuelle) ──
app.post('/api/sms/detect', async (req, res) => {
  const { From, Body, zone } = req.body;
  
  if (!Body) return res.status(400).json({ error: 'Message requis' });

  console.log(`[SMS_DETECTOR] Message reçu — De: ${From}, Zone: ${zone}, Texte: ${Body}`);

  // 1. Classifier le message
  const classification = alertDetector.classifyMessage(Body, zone);
  console.log(`[SMS_DETECTOR] Classification: ${classification.type} (${(classification.confidence * 100).toFixed(0)}%)`);

  // 2. Ajouter aux alertes agrégées
  const aggregationResult = alertAggregator.addMessage(Body, zone || 'default', classification.type);
  console.log(`[SMS_DETECTOR] Agrégation: ${aggregationResult.messageCount}/3 pour ${zone}`);

  // 3. Si alerte auto déclenchée → lancer campagne
  if (aggregationResult.triggered) {
    console.log(`[SMS_DETECTOR] 🚨 ALERTE AUTO DÉCLENCHÉE — ${aggregationResult.zone}/${aggregationResult.type}`);
    
    const contacts = db.getContacts().filter(c => c.zone === zone);
    
    if (contacts.length > 0) {
      // Créer une alerte automatique
      const alert = db.createAlert({
        type: `AUTO_${classification.type.toUpperCase()}`,
        message: `Détection automatique: ${aggregationResult.messageCount} rapports de ${classification.type} à ${zone}`,
        auto: true,
        zone: zone
      });

      // Lancer les appels en arrière-plan
      setImmediate(async () => {
        for (const contact of contacts) {
          const call = db.createCallRecord({
            contactId: contact.id,
            alertId: alert.id,
            alertType: `AUTO_${classification.type.toUpperCase()}`
          });

          db.updateCall(call.id, { status: 'CALLING', attempts: 1 });

          try {
            await calls.originate({
              phone: contact.phone,
              contactId: call.id,
              alertId: alert.id,
              alertType: `AUTO_${classification.type.toUpperCase()}`,
              message: alert.message
            });
          } catch (err) {
            console.error(`[SMS_DETECTOR] Erreur appel: ${err.message}`);
            db.updateCall(call.id, { status: 'FAILED' });
          }

          io.emit('stats_update', db.getStats(alert.id));
          await new Promise(r => setTimeout(r, 3000));
        }
      });

      return res.status(200).json({
        message: 'SMS analysé et alerte automatique déclenchée',
        classification,
        alert: alert,
        contacts_notified: contacts.length
      });
    }
  }

  res.status(200).json({
    message: 'SMS analysé et stocké',
    classification,
    aggregation: {
      count: aggregationResult.messageCount,
      threshold: aggregationResult.threshold,
      threshold_reached: aggregationResult.threshold_reached
    }
  });
});

// ── Stats des alertes par zone ──────────────────────────────
app.get('/api/sms/zones', (req, res) => {
  const { zone } = req.query;
  
  if (zone) {
    res.json(alertAggregator.getZoneStatus(zone));
  } else {
    res.json(alertAggregator.getAlertStats());
  }
});

// ── Dashboard de détection (historique) ─────────────────────
app.get('/api/sms/dashboard', (req, res) => {
  const stats = alertAggregator.getAlertStats();
  const allAlerts = db.getActiveAlerts();
  
  res.json({
    detection_stats: stats,
    active_alerts: allAlerts.filter(a => a.auto),
    message: 'Dashboard de détection d\'alertes'
  });
});
// ── Twilio TwiML pour appels ──────────────────────────────────
// SUPPRIMÉ: Routes liées à Twilio TwiML (mode Asterisk AMI à la place)

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
  console.log('[APP] Architecture: VPS (brain) + Local Asterisk');

  // Initialiser Asterisk AMI
  const ami = new AmiClient();
  
  try {
    await ami.connect();
    console.log('[APP] ✅ Asterisk AMI connecté');
    
    // Injecter AMI dans les modules
    calls.setAmi(ami);
    sms.setAmi(ami);
    retry.init(ami, io);
    
    // Lancer le serveur AGI
    startAgiServer(io);
    
    // Écouter les événements AMI
    bindAmiEvents(ami, io);
    
    console.log('[APP] ✅ Systeme SMS/Calls initialisé via Asterisk');
  } catch (err) {
    console.error('[APP] ⚠️  Erreur connexion Asterisk:', err.message);
    console.warn('[APP] Mode DÉGRADÉ — SMS/Calls désactivés');
    console.warn('[APP] Détection SMS et API fonctionnent normalement');
    console.warn('[APP] Pour activer: Assurez-vous Asterisk est en cours d\'exécution sur', 
      process.env.AMI_HOST || '127.0.0.1', ':', process.env.AMI_PORT || 5038);
    
    // Initialiser sans AMI
    calls.init();
    sms.init();
    retry.init(null, io);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[APP] ✅ Serveur HTTP démarré → http://0.0.0.0:${PORT}`);
    console.log('[APP] Dashboard → http://localhost:' + PORT);
    console.log('[APP] API NLP pour détection SMS: POST /api/sms/detect');
    console.log('[APP] Zone: POST /api/sms/zones');
    console.log('[APP] Dashboard de détection: GET /api/sms/dashboard');
  });
}

main().catch(console.error);
