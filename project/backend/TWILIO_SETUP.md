# Configuration Twilio pour AlertGo

## Variables d'environnement requises

Créez un fichier `.env` à la racine du dossier `/backend` avec les valeurs suivantes:

```env
# ──── Twilio ────────────────────────────────────────────
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+33XXXXXXXXX

# ──── Serveur ───────────────────────────────────────────
PORT=3000
AMI_HOST=127.0.0.1
AMI_PORT=5038

# ──── Alertes ───────────────────────────────────────────
CALL_DELAY_MS=3000
MAX_ATTEMPTS=3
RETRY_INTERVAL_MS=300000

# ──── Callback Twilio (URL publique pour webhooks) ─────
TWILIO_CALLBACK_URL=https://votre-domaine.com/api/calls/twiml
```

## Comment obtenir les identifiants Twilio

1. Accédez à https://www.twilio.com/console
2. Connectez-vous ou créez un compte
3. Récupérez votre **Account SID** et **Auth Token** depuis le dashboard
4. Allez dans la section "Phone Numbers" → "Manage Numbers"
5. Achetez ou activez un numéro Twilio (ex: +33XXXXXXXXX)
6. Copiez le numéro comme `TWILIO_FROM_NUMBER`

## Installation des dépendances

```bash
cd project/backend
npm install
```

## Démarrage

```bash
npm start
```

## API Endpoints

### SMS
```bash
POST /api/sms
{
  "phone": "+33612345678",
  "message": "Texte du SMS"
}
```

### Alerte (Appels + SMS)
```bash
POST /api/alerts
{
  "type": "ALERTE_INONDATION",
  "message": "Risque d'inondation",
  "sendSmsAlso": true
}
```

## Notes importantes

- **TWILIO_CALLBACK_URL** doit être accessible depuis internet (Twilio a besoin de faire des requêtes POST)
- Si vous êtes en développement local, utilisez `ngrok` pour créer un tunnel public
- Les SMS sont limités à 160 caractères
- Les appels vocaux utilisent TwiML (Text-to-Speech en français)

## Dépannage

**Les appels ne fonctionnent pas?**
- Vérifiez que `TWILIO_CALLBACK_URL` est accessible
- Consultez les logs Twilio dans la console Twilio

**Les SMS ne sont pas reçus?**
- Assurez-vous que le numéro Twilio est valide
- Vérifiez le format du numéro de destination (+33...)

