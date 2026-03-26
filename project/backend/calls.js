// ============================================================
// calls.js — Appels téléphoniques via Asterisk (version hybride)
// ============================================================
const { AmiClient } = require('./asterisk');

let ami = null;

function init() {
  // La connexion AMI sera établie par app.js lors du startup
  console.log('[CALLS] Module CALLS initialisé (Asterisk)');
  return true;
}

// Récupère l'instance AMI (injectée par app.js)
function setAmi(amiInstance) {
  ami = amiInstance;
}

// Originate un appel vers un contact via Asterisk dongle
async function originate({ phone, contactId, alertId, alertType, message }) {
  if (!ami || !ami.connected) {
    console.error('[CALLS] AMI non connecté');
    return { success: false, error: 'Asterisk non connecté' };
  }

  try {
    const result = await ami.originate({ 
      phone, 
      contactId, 
      alertId, 
      alertType 
    });

    if (result.Response === 'Success') {
      console.log(`[CALLS] ${phone} → Originate lancé ✅`);
      return { success: true, originateId: result.ActionID };
    } else {
      console.warn(`[CALLS] ${phone} → Erreur Asterisk: ${result.Message}`);
      return { success: false, error: result.Message };
    }
  } catch (err) {
    console.error(`[CALLS] Erreur ${phone}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = { init, setAmi, originate };

function generateTwiML(alertType, message) {
  const VoiceMessage = `Alerte ${alertType}. ${message}. Appuyez sur 1 pour confirmer la réception, ou raccrochez.`;
  
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    { voice: 'alice', language: 'fr-FR' },
    VoiceMessage
  );
  twiml.gather({
    action: '/api/calls/confirm',
    method: 'POST',
    numDigits: 1,
    timeout: 30
  });
  
  return twiml.toString();
}

// Générer TwiML pour la confirmation d'appel
function generateConfirmTwiML() {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: 'alice', language: 'fr-FR' }, 'Merci. Alerte confirmée.');
  twiml.hangup();
  return twiml.toString();
}

module.exports = { init, originate, generateTwiML, generateConfirmTwiML };
