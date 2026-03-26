// ============================================================
// db.js — Base de données JSON (contacts + appels + réponses)
// ============================================================
const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Structure initiale
const DEFAULT_DB = {
  contacts: [],   // { id, name, phone, lat, lng, zone }
  calls:    [],   // { id, contactId, alertType, status, response, attempts, createdAt, updatedAt }
  alerts:   []    // { id, type, message, createdAt, active }
};

// ── Utilitaires ──────────────────────────────────────────────
function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Contacts ─────────────────────────────────────────────────
function getContacts() {
  return load().contacts;
}

function addContact({ name, phone, lat, lng, zone }) {
  const db = load();
  const contact = { id: uid(), name, phone, lat: parseFloat(lat), lng: parseFloat(lng), zone: zone || 'default', createdAt: new Date().toISOString() };
  db.contacts.push(contact);
  save(db);
  return contact;
}

function getContactById(id) {
  return load().contacts.find(c => c.id === id);
}

// ── Appels ───────────────────────────────────────────────────
function getCalls(alertId) {
  const db = load();
  return alertId ? db.calls.filter(c => c.alertId === alertId) : db.calls;
}

function createCallRecord({ contactId, alertId, alertType }) {
  const db = load();
  const call = {
    id:        uid(),
    contactId,
    alertId,
    alertType,
    status:    'PENDING',   // PENDING | CALLING | ANSWERED | BUSY | NOANSWER | FAILED
    response:  null,        // 1 | 2 | 3 | 0 (pas de réponse IVR)
    attempts:  0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.calls.push(call);
  save(db);
  return call;
}

function updateCall(id, fields) {
  const db = load();
  const idx = db.calls.findIndex(c => c.id === id);
  if (idx === -1) return null;
  db.calls[idx] = { ...db.calls[idx], ...fields, updatedAt: new Date().toISOString() };
  save(db);
  return db.calls[idx];
}

function getCallByContactAndAlert(contactId, alertId) {
  return load().calls.find(c => c.contactId === contactId && c.alertId === alertId);
}

function getPendingRetries(maxAttempts = 3) {
  const db = load();
  return db.calls.filter(c =>
    ['BUSY', 'NOANSWER', 'FAILED'].includes(c.status) &&
    c.attempts < maxAttempts &&
    c.response === null
  );
}

// ── Alertes ──────────────────────────────────────────────────
function createAlert({ type, message }) {
  const db = load();
  const alert = { id: uid(), type, message, createdAt: new Date().toISOString(), active: true };
  db.alerts.push(alert);
  save(db);
  return alert;
}

function getActiveAlerts() {
  return load().alerts.filter(a => a.active);
}

function getAlertById(id) {
  return load().alerts.find(a => a.id === id);
}

// ── Stats pour le dashboard ───────────────────────────────────
function getStats(alertId) {
  const db   = load();
  const calls = alertId ? db.calls.filter(c => c.alertId === alertId) : db.calls;
  return {
    total:     calls.length,
    answered:  calls.filter(c => c.status === 'ANSWERED').length,
    busy:      calls.filter(c => c.status === 'BUSY').length,
    noanswer:  calls.filter(c => c.status === 'NOANSWER').length,
    failed:    calls.filter(c => c.status === 'FAILED').length,
    pending:   calls.filter(c => c.status === 'PENDING' || c.status === 'CALLING').length,
    responses: {
      '1': calls.filter(c => c.response === '1').length,
      '2': calls.filter(c => c.response === '2').length,
      '3': calls.filter(c => c.response === '3').length,
      '0': calls.filter(c => c.response === '0').length
    }
  };
}

// ── Données pour la carte ─────────────────────────────────────
function getMapData(alertId) {
  const db = load();
  const calls = alertId ? db.calls.filter(c => c.alertId === alertId) : db.calls;
  return calls.map(call => {
    const contact = db.contacts.find(c => c.id === call.contactId);
    return { ...call, contact };
  }).filter(c => c.contact && c.contact.lat && c.contact.lng);
}

module.exports = {
  getContacts, addContact, getContactById,
  getCalls, createCallRecord, updateCall,
  getCallByContactAndAlert, getPendingRetries,
  createAlert, getActiveAlerts, getAlertById,
  getStats, getMapData
};
