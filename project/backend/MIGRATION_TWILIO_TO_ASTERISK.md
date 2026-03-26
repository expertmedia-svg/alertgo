# Migration Twilio → Asterisk Hybride

**Date**: Version 2.0 (Post-Twilio)  
**Status**: ✅ Prêt pour déploiement  
**Justification**: Twilio n'a pas de support pour les numéros Burkina Faso

## Résumé des changements

| Aspect | Avant (Twilio) | Après (Asterisk Hybride) |
|--------|---|---|
| **Provider SMS** | Cloud Twilio API | Local Asterisk + chan_dongle |
| **Provider Appels** | Cloud Twilio API | Local Asterisk AMI Originate |
| **Infrastructure** | Cloud-only (simple) | Hybride VPS + Local (résilient) |
| **Coûts** | $0.0075/SMS + abonnement | Coûts hardware (dongles) + Internet |
| **Couverture** | Globale (sauf Burkina) | Locale (pays où SIM est active) |
| **Latence** | 500ms-2s (cloud) | < 100ms (local) |
| **Dépendance Internet** | Critique | Tolérant (buffering local possible) |
| **Contrôle** | Limité (API Twilio) | Complet (Asterisk local) |

## Fichiers modifiés

### 1. **calls.js** (Complètement refondue)

**Avant** (Twilio):
```javascript
const twilio = require('twilio');
twilioClient.calls.create({ from, to, url })
```

**Après** (Asterisk AMI):
```javascript
const { AmiClient } = require('./asterisk');
ami.originate({ phone, contactId, alertId, alertType })
```

**Impact API**:
- ✅ Même signature dans app.js → Aucun changement requis côté appelants
- ✅ Gestion d'erreurs similaire
- ✅ Logs compatibles

### 2. **sms.js** (Complètement refondue)

**Avant** (Twilio):
```javascript
twilioClient.messages.create({ from, to, body })
```

**Après** (Asterisk AMI):
```javascript
ami.sendSms({ phone, message })
```

**Impact API**:
- ✅ Même signature `sendSms()` → Pas de changements dans app.js
- ✅ Fonction `sendAlertSms()` préservée

### 3. **asterisk.js** (Améliorations)

**Nouvelles méthodes**:
- `ami.originate()` — Originate appels via dongle GSM
- `ami.sendSms()` — Envoyer SMS via DongleSendSMS
- AGI Server — Recevoir callbacks des appels entrants

### 4. **app.js** (Gestion AMI)

**Avant**:
```javascript
sms.init();
calls.init();
```

**Après**:
```javascript
const ami = new AmiClient();
await ami.connect();
calls.setAmi(ami);
sms.setAmi(ami);
```

**Routes supprimées** (Twilio TwiML):
- ~~POST /api/calls/twiml~~ (TwiML XML)
- ~~POST /api/calls/confirm~~ (DTMF confirmation)

**Routes ajoutées** (Détection SMS):
- ✅ POST /api/sms/detect (Analyse IA)
- ✅ GET /api/sms/zones (Stats par zone)
- ✅ GET /api/sms/dashboard (Dashboard)

### 5. **package.json**

**Supprimé**:
```json
"twilio": "^4.0.0"
```

**Conservé**:
- cors, express, socket.io, fuse.js (tous inchangés)

### 6. **retry.js**

✅ **Inchangé** — Fonctionne identiquement avec le nouvel Asterisk

## Impact client (API HTTP)

### ✅ Pas de changement pour l'utilisateur

Les endpoints existants continuent à fonctionner:

```bash
# Avant et après — identique
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "type": "feu",
    "message": "Incendie détecté",
    "sendSmsAlso": true
  }'
```

## Configuration requise

### Avant (Twilio)
```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+33...
```

### Après (Asterisk)
```env
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USER=alertadmin
AMI_SECRET=alertpass123
DONGLES=dongle0,dongle1
```

**Voir**: [ASTERISK_HYBRID_SETUP.md](./ASTERISK_HYBRID_SETUP.md)

## Mode dégradé

Si Asterisk n'est pas disponible au démarrage:

```
[APP] ⚠️ Erreur connexion Asterisk: ECONNREFUSED
[APP] Mode DÉGRADÉ — SMS/Calls désactivés
[APP] Détection SMS et API fonctionnent normalement
```

✅ Le serveur démarre quand même  
✅ Détection SMS (NLP) fonctionne  
❌ Appels/SMS réels désactivés  

Cela permet le développement/test sans hardware Asterisk.

## Avantages de la migration

### 1. **Couverture Burkina Faso**
- Twilio: ❌ Pas supported
- Asterisk: ✅ Carte SIM locale active

### 2. **Coûts réduits**
- Twilio: $0.0075/SMS × 10,000 mensuel = $75 + frais
- Asterisk: ~$200 hardware (once) + ~$30 crédit SIM/mois

### 3. **Contrôle complet**
- Twilio: Limited à TwiML/API
- Asterisk: Dialplan complet, modules extensibles

### 4. **Performance**
- Twilio: 500-2000ms round-trip
- Asterisk: <100ms (local network)

### 5. **Résilience locale**
- Twitter: Dépend Internet constant
- Asterisk: Fonctionnement en dégradé possible (buffering local)

## Changements comportementaux

### SMS
| Aspect | Avant | Après |
|--------|---|---|
| Rate limit | 1 msg/sec | 1 msg/100ms |
| SID returned | Twilio UUID | AMI ActionID |
| Encoding | UTF-8 → 7bit | UTF-8 → GSM 7-bit (dongle) |
| Max length | 160 chars | 160 chars |

### Appels
| Aspect | Avant | Après |
|--------|---|---|
| IVR | TwiML XML | AGI dialplan |
| Confirmation | DTMF callback | Asterisk application |
| Hangup | HTTP callback | Asterisk event |
| CID | Twilio number | Configurable (0000) |

## Migration des donnees

✅ **Aucune données à migrer**

- Format stockage (JSON) inchangé
- Contacts, alertes, appels: même structure
- Historique importé automatiquement

## Checklist de déploiement

- [ ] Installer Asterisk + chan_dongle sur machine locale
- [ ] Configurer dongle.conf, manager.conf, extensions.conf
- [ ] Tester AMI: `telnet localhost 5038`
- [ ] Vérifier firewall: port 5038, 4573 accessibles (si distant)
- [ ] Configurer .env avec variables AMI
- [ ] Lancer: `npm start`
- [ ] Tester: `curl -X POST http://localhost:3000/api/sms/detect -d ...`
- [ ] Créer contact test: `api/contacts`
- [ ] Déclencher alerte: `api/alerts`
- [ ] Vérifier appel/SMS sur dongle

## Documentations de référence

1. **Setup Asterisk**: [ASTERISK_HYBRID_SETUP.md](./ASTERISK_HYBRID_SETUP.md)
2. **Détection SMS**: [SMS_DETECTION.md](./SMS_DETECTION.md)
3. **API Reference**: [README.md](./README.md)
4. **System Overview**: [README_SYSTEM.md](./README_SYSTEM.md)

## Support et troubleshooting

Voir [ASTERISK_HYBRID_SETUP.md - Dépannage](./ASTERISK_HYBRID_SETUP.md#dépannage) pour:
- Erreurs connexion AMI
- Problèmes detection dongle
- Problèmes SMS non envoyé
- Rate limiting
- Permissions

## Prochaines étapes

1. ✅ Test en développement local
2. 🔜 Déploiement sur VPS (avec SSH tunnel)
3. 🔜 Configuration multi-dongle pour scaling
4. 🔜 Intégration voicemail/transcription SMS
5. 🔜 Dashboard web temps réel

---

**Questions?** Voir les docs d'Asterisk ou contacter l'équipe d'infrastructure.
