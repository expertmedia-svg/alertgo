# ✅ Migration Asterisk → Twilio Complète

## Changements effectués

### 1. **package.json**
- ✅ Ajouté dépendance `twilio` (v3.90.0)

### 2. **sms.js** (Refactorisé)
- ❌ Supprimé: Dépendance à Asterisk AMI
- ✅ Ajouté: Client Twilio
- ✅ Fonctions: `init()`, `sendSms()`, `sendAlertSms()`

### 3. **calls.js** (NOUVEAU)
- ✅ Gestion des appels téléphoniques via Twilio
- ✅ Génération TwiML (synthèse vocale + saisie DTMF)
- ✅ Fonctions: `init()`, `originate()`, `generateTwiML()`, `generateConfirmTwiML()`

### 4. **app.js** (Adapté)
- ❌ Supprimé: Import d'Asterisk (`AmiClient`, `startAgiServer`, `bindAmiEvents`, `nextDongle`)
- ✅ Ajouté: Imports `calls` et `sms` (modules Twilio)
- ✅ Routes TwiML: `POST /api/calls/twiml`, `POST /api/calls/confirm`
- ✅ Initialisation Twilio au démarrage

### 5. **retry.js** (Adapté)
- ❌ Supprimé: Référence à Asterisk
- ✅ Ajouté: Import du module `calls`
- ✅ Utilisation de `calls.originate()` pour les relances

### 6. **Documentation**
- ✅ Créé `TWILIO_SETUP.md` — Guide complet de configuration
- ✅ Créé `.env.example` — Variables requises
- ✅ Créé `.gitignore` — Ignorer `.env` et `node_modules`

---

## 🚀 Prochaines étapes

### 1. Installer Twilio
```bash
cd project/backend
npm install
```

### 2. Configurer vos identifiants Twilio
```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer .env et ajouter vos clés Twilio
nano .env
```

Variables requises dans `.env`:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=ton_token_ici
TWILIO_FROM_NUMBER=+33701234567
TWILIO_CALLBACK_URL=https://votre-domaine.com/api/calls/twiml
```

### 3. Obtenir les identifiants Twilio
1. Allez sur https://www.twilio.com/console
2. Créez un compte gratuit (100$ de crédit)
3. Récupérez **Account SID** et **Auth Token**
4. Achetez ou activez un **numéro Twilio**

### 4. Tester localement avec ngrok (pour les webhooks)
```bash
# Installez ngrok: https://ngrok.com
ngrok http 3000

# Utilisez l'URL générée (ex: https://xxxx-xx-xxx-xxx-xx.ngrok.io)
# Et mettez-la dans .env comme TWILIO_CALLBACK_URL
```

### 5. Démarrer le serveur
```bash
npm start
```

### 6. Tester l'API
```bash
# Tester SMS
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "+33612345678", "message": "Test SMS"}'

# Tester une alerte
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"type": "TEST", "message": "Ceci est un test", "sendSmsAlso": true}'
```

---

## 💰 Tarification Twilio

- **SMS**: ~0.007€ par SMS
- **Appels**: ~0.05€ par minute
- **Compte gratuit**: 50€/mois pendant 30 jours

---

## ⚠️ Points importants

1. **TWILIO_CALLBACK_URL** doit être accessible depuis internet pour que les webhooks fonctionnent
2. Les appels vocaux utilisent TwiML avec synthèse vocale en français
3. Les SMS sont limités à 160 caractères
4. La saisie DTMF (touches du clavier) pendant les appels nécessite des webhooks configurés

---

## 🔗 Ressources Utiles

- [Documentation Twilio SMS](https://www.twilio.com/docs/sms)
- [Documentation Twilio Voice](https://www.twilio.com/docs/voice)
- [Guide TwiML](https://www.twilio.com/docs/voice/twiml)
- [ngrok pour les webhooks](https://ngrok.com)

---

**Status**: ✅ Intégration Twilio complète et prête à être testée!
