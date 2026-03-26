// ============================================================
// sms.js — Envoi SMS via Asterisk (version hybride)
// ============================================================
const { AmiClient } = require('./asterisk');

let ami = null;

function init() {
  // La connexion AMI sera établie par app.js lors du startup
  console.log('[SMS] Module SMS initialisé (Asterisk)');
  return true;
}

// Récupère l'instance AMI (injectée par app.js)
function setAmi(amiInstance) {
  ami = amiInstance;
}

// Envoyer un SMS via dongle Asterisk
async function sendSms({ phone, message }) {
  if (!ami || !ami.connected) {
    console.error('[SMS] AMI non connecté');
    return { success: false, error: 'Asterisk non connecté' };
  }

  try {
    const result = await ami.sendSms({ 
      phone, 
      message: message.slice(0, 160)  // Limite SMS
    });

    if (result.Response === 'Success') {
      console.log(`[SMS] ${phone} ✅`);
      return { success: true, messageId: result.ActionID };
    } else {
      console.warn(`[SMS] ${phone} → Erreur Asterisk: ${result.Message}`);
      return { success: false, error: result.Message };
    }
  } catch (err) {
    console.error(`[SMS] Erreur ${phone}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// Envoyer SMS d'alerte à tous les contacts
async function sendAlertSms(contacts, alertType, message) {
  const results = [];

  for (const contact of contacts) {
    const smsText = `ALERTE [${alertType.toUpperCase()}]: ${message} — Appelez le 112 si urgence.`;
    const res = await sendSms({ phone: contact.phone, message: smsText });
    results.push({ contactId: contact.id, phone: contact.phone, ...res });
    
    // Pause entre envois (rate limiting: 1 SMS/100ms)
    await new Promise(r => setTimeout(r, 100));
  }

  return results;
}

module.exports = { init, setAmi, sendSms, sendAlertSms };
