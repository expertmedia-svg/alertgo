// ============================================================
// retry.js — Rappels automatiques pour les non-répondants
// ============================================================
const db       = require('./db');
const { nextDongle } = require('./asterisk');

let _ami = null;
let _io  = null;
let retryTimer = null;

const MAX_ATTEMPTS     = parseInt(process.env.MAX_ATTEMPTS) || 3;
const RETRY_INTERVAL   = parseInt(process.env.RETRY_INTERVAL_MS) || 5 * 60 * 1000; // 5 min
const CALL_DELAY_MS    = parseInt(process.env.CALL_DELAY_MS) || 3000; // 3s entre appels

function init(ami, io) {
  _ami = ami;
  _io  = io;
}

function start() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = setInterval(runRetry, RETRY_INTERVAL);
  console.log(`[RETRY] Scheduler démarré — intervalle ${RETRY_INTERVAL / 1000}s, max ${MAX_ATTEMPTS} tentatives`);
}

function stop() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = null;
}

async function runRetry() {
  const pending = db.getPendingRetries(MAX_ATTEMPTS);
  if (pending.length === 0) {
    console.log('[RETRY] Aucun rappel nécessaire');
    return;
  }

  console.log(`[RETRY] ${pending.length} appel(s) à relancer`);

  for (const call of pending) {
    const contact = db.getContactById(call.contactId);
    if (!contact) continue;

    const alert = db.getAlertById(call.alertId);
    if (!alert || !alert.active) continue;

    db.updateCall(call.id, { status: 'CALLING', attempts: call.attempts + 1 });
    console.log(`[RETRY] Rappel tentative ${call.attempts + 1}/${MAX_ATTEMPTS} — ${contact.phone}`);

    try {
      await _ami.originate({
        phone:      contact.phone,
        contactId:  call.id,        // on réutilise le même call ID pour le tracking
        alertId:    call.alertId,
        alertType:  call.alertType,
        dongle:     nextDongle()
      });
    } catch (err) {
      console.error(`[RETRY] Erreur originate: ${err.message}`);
      db.updateCall(call.id, { status: 'FAILED' });
    }

    _io && _io.emit('stats_update', db.getStats(call.alertId));

    // Délai entre appels successifs
    await new Promise(r => setTimeout(r, CALL_DELAY_MS));
  }
}

// Lancer les rappels immédiatement (hors scheduler)
async function triggerNow() {
  return runRetry();
}

module.exports = { init, start, stop, triggerNow };
