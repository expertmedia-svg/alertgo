// ============================================================
// sms.js — Envoi SMS via Asterisk chan_dongle (AMI SendText)
// ============================================================
const { AmiClient } = require('./asterisk');

let _ami = null;

function setAmi(ami) {
  _ami = ami;
}

// Envoyer un SMS via un dongle spécifique
async function sendSms({ phone, message, dongle = 'dongle0' }) {
  if (!_ami || !_ami.connected) {
    console.error('[SMS] AMI non connecté');
    return { success: false, error: 'AMI non connecté' };
  }

  // chan_dongle utilise l'action DongleSendSMS
  const result = await _ami._action({
    Action:  'DongleSendSMS',
    Device:  dongle,
    Number:  phone,
    Message: message.slice(0, 160)  // Limite SMS standard
  });

  const ok = result && result.Response === 'Success';
  console.log(`[SMS] ${phone} via ${dongle} — ${ok ? 'OK' : 'ÉCHEC'}`);
  return { success: ok, result };
}

// Envoyer SMS d'alerte à tous les contacts
async function sendAlertSms(contacts, alertType, message) {
  const DONGLES = (process.env.DONGLES || 'dongle0,dongle1').split(',');
  const results = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const dongle  = DONGLES[i % DONGLES.length];
    const smsText = `ALERTE [${alertType.toUpperCase()}]: ${message} — Appelez le 112 si urgence.`;

    const res = await sendSms({ phone: contact.phone, message: smsText, dongle });
    results.push({ contactId: contact.id, phone: contact.phone, ...res });

    // Pause entre envois pour éviter la saturation du modem
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

module.exports = { setAmi, sendSms, sendAlertSms };
