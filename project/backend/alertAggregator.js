// ============================================================
// alertAggregator.js — Agrégation d'alertes par zone
// ============================================================
// Compte les alertes reçues et déclenche alerte auto si seuil atteint
// Gère le throttling et la déduplication

const db = require('./db');

// ── Configuration ─────────────────────────────────────────
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD) || 3;  // nb messages pour trigger
const ALERT_WINDOW_MS = parseInt(process.env.ALERT_WINDOW_MS) || 10 * 60 * 1000;  // 10 min
const THROTTLE_MS = parseInt(process.env.THROTTLE_MS) || 5 * 60 * 1000;  // 5 min entre alertes identiques

// ── In-memory store (peut être étendu à une DB) ─────────
let zoneAlerts = {};  // { zone: { feu: [msgs...], eau: [...], }, timestamp: ... }
let lastAlertTime = {};  // { "zone_type": timestamp } pour éviter spam

/**
 * Ajouter un message à la file d'attente
 */
function addMessage(message, zone, alertType) {
  if (!zoneAlerts[zone]) {
    zoneAlerts[zone] = {};
  }

  if (!zoneAlerts[zone][alertType]) {
    zoneAlerts[zone][alertType] = [];
  }

  zoneAlerts[zone][alertType].push({
    message,
    timestamp: Date.now(),
    processed: false
  });

  // Nettoyer les messages anciens (> ALERT_WINDOW_MS)
  const now = Date.now();
  zoneAlerts[zone][alertType] = zoneAlerts[zone][alertType].filter(
    m => now - m.timestamp < ALERT_WINDOW_MS
  );

  // Vérifier si on déclenche une alerte auto
  return checkAndTriggerAlert(zone, alertType);
}

/**
 * Vérifier si on doit déclencher une alerte automatique
 */
function checkAndTriggerAlert(zone, alertType) {
  const alerts = zoneAlerts[zone]?.[alertType] || [];
  const count = alerts.length;

  // Clé pour throttling
  const throttleKey = `${zone}_${alertType}`;
  const lastTime = lastAlertTime[throttleKey] || 0;
  const timeSinceLastAlert = Date.now() - lastTime;

  // Vérifier conditions de trigger
  if (
    count >= ALERT_THRESHOLD &&
    timeSinceLastAlert > THROTTLE_MS
  ) {
    console.log(`[ALERT_AGGREGATOR] ⚠️ ALERTE AUTO — Zone: ${zone}, Type: ${alertType}, Count: ${count}`);

    // Marquer les messages comme traités
    alerts.forEach(a => a.processed = true);

    // Mettre à jour le throttle
    lastAlertTime[throttleKey] = Date.now();

    return {
      triggered: true,
      zone,
      type: alertType,
      messageCount: count,
      messages: alerts.map(a => a.message),
      shouldCallContacts: true
    };
  }

  return {
    triggered: false,
    zone,
    type: alertType,
    messageCount: count,
    threshold: ALERT_THRESHOLD,
    threshold_reached: count >= ALERT_THRESHOLD,
    throttled: timeSinceLastAlert < THROTTLE_MS && count >= ALERT_THRESHOLD
  };
}

/**
 * Obtenir le statut des alertes pour une zone
 */
function getZoneStatus(zone) {
  if (!zoneAlerts[zone]) {
    return { zone, alerts: {}, total: 0 };
  }

  const status = { zone, alerts: {}, total: 0 };
  
  for (const [alertType, messages] of Object.entries(zoneAlerts[zone])) {
    const unprocessed = messages.filter(m => !m.processed);
    status.alerts[alertType] = {
      count: messages.length,
      unprocessed: unprocessed.length,
      messages: unprocessed.map(m => ({ text: m.message, time: m.timestamp }))
    };
    status.total += messages.length;
  }

  return status;
}

/**
 * Obtenir la distribution d'alertes (pour stats)
 */
function getAlertStats() {
  const stats = { zones: {}, total_messages: 0, active_zones: 0 };

  for (const [zone, types] of Object.entries(zoneAlerts)) {
    const zoneTotal = Object.values(types).reduce((sum, arr) => sum + arr.length, 0);
    
    if (zoneTotal > 0) {
      stats.zones[zone] = zoneTotal;
      stats.total_messages += zoneTotal;
      stats.active_zones++;
    }
  }

  return stats;
}

/**
 * Réinitialiser les alertes d'une zone (après traitement)
 */
function clearZone(zone) {
  delete zoneAlerts[zone];
  console.log(`[ALERT_AGGREGATOR] Zone ${zone} réinitialisée`);
}

/**
 * Réinitialiser tout (debug)
 */
function clearAll() {
  zoneAlerts = {};
  lastAlertTime = {};
  console.log('[ALERT_AGGREGATOR] Toutes les alertes réinitialisées');
}

/**
 * Exporter historique (sauvegarde)
 */
function exportHistory() {
  return {
    timestamp: new Date().toISOString(),
    zones: JSON.parse(JSON.stringify(zoneAlerts)),
    lastAlertTime
  };
}

/**
 * Importer historique (récupération)
 */
function importHistory(data) {
  if (data.zones) zoneAlerts = data.zones;
  if (data.lastAlertTime) lastAlertTime = data.lastAlertTime;
  console.log('[ALERT_AGGREGATOR] Historique restauré');
}

module.exports = {
  addMessage,
  checkAndTriggerAlert,
  getZoneStatus,
  getAlertStats,
  clearZone,
  clearAll,
  exportHistory,
  importHistory
};
