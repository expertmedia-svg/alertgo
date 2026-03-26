# 🚨 Plateforme d'Alerte Communautaire
## GSM + Asterisk + Node.js + Leaflet offline

---

## 📁 Structure
```
project/
├── asterisk/
│   ├── extensions.conf   # Dialplan IVR
│   ├── sip.conf          # Config SIP locale
│   ├── dongle.conf       # Config modems GSM USB
│   └── manager.conf      # AMI (ajout à /etc/asterisk/manager.conf)
├── backend/
│   ├── app.js            # Express + Socket.IO
│   ├── asterisk.js       # AMI client + AGI serveur
│   ├── sms.js            # Envoi SMS via chan_dongle
│   ├── db.js             # Base JSON (contacts/appels/alertes)
│   ├── retry.js          # Scheduler rappels automatiques
│   └── data/db.json      # Base de données (auto-créée)
├── frontend/
│   ├── index.html        # Dashboard tout-en-un
│   └── leaflet/          # Leaflet offline (JS+CSS+tiles)
├── audio/                # Fichiers WAV sources (à enregistrer)
└── setup.sh              # Installation automatique
```

---

## ⚡ Installation rapide

```bash
git clone <repo> && cd project
sudo bash setup.sh
```

Ou manuellement :
```bash
# Dépendances
sudo apt-get install -y asterisk asterisk-chan-dongle nodejs npm sox

# Copier configs Asterisk
sudo cp asterisk/extensions.conf /etc/asterisk/
sudo cp asterisk/sip.conf        /etc/asterisk/
sudo cp asterisk/dongle.conf     /etc/asterisk/
sudo cat asterisk/manager.conf >> /etc/asterisk/manager.conf
sudo systemctl restart asterisk

# Backend
cd backend && npm install
node app.js
```

---

## 🔧 Configuration dongle

```bash
# Identifier vos ports USB
ls /dev/ttyUSB* /dev/ttyACM*
# ou
dmesg | grep ttyUSB

# Vérifier dans Asterisk
asterisk -rx 'dongle show devices'
```

Éditer `/etc/asterisk/dongle.conf` :
```ini
[dongle0]
audio=/dev/ttyUSB1   # ← adapter
data=/dev/ttyUSB2    # ← adapter
```

---

## 🎙️ Fichiers audio (IMPORTANT)

Enregistrer les vrais messages en 8kHz mono WAV :
```bash
AUDIO_DIR="/var/lib/asterisk/sounds/custom"

# Avec microphone
arecord -f S16_LE -r 8000 -c 1 $AUDIO_DIR/bienvenue.wav
# Ctrl+C pour arrêter

# Convertir un MP3 existant
sox message.mp3 -r 8000 -c 1 -b 16 $AUDIO_DIR/bienvenue.wav
```

**Contenu suggéré :**
- `bienvenue.wav` : *"Bonjour, vous recevez une alerte communautaire."*
- `menu.wav` : *"Appuyez sur 1 si vous êtes en sécurité, sur 2 si vous avez besoin d'aide, sur 3 pour confirmer l'information."*
- `feu.wav` : *"ATTENTION : Un incendie a été signalé dans votre secteur. Restez à l'écart."*
- `eau.wav` : *"ATTENTION : Risque d'inondation dans votre zone. Montez en hauteur."*
- `communaute.wav` : *"Message important de votre communauté."*

---

## 🧪 Tests cURL

### 1. Ajouter des contacts
```bash
# Contact unique
curl -s -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"name":"Amadou Traoré","phone":"+22676000001","lat":11.1771,"lng":-4.2979,"zone":"Secteur 10"}' | jq

# Import en masse
curl -s -X POST http://localhost:3000/api/contacts/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      {"name":"Fatoumata Coulibaly","phone":"+22676000002","lat":11.1785,"lng":-4.2955,"zone":"Secteur 2"},
      {"name":"Ibrahim Sawadogo","phone":"+22670000003","lat":11.1760,"lng":-4.3010,"zone":"Secteur 5"},
      {"name":"Mariama Diallo","phone":"+22666000004","lat":11.1800,"lng":-4.2900,"zone":"Koko"}
    ]
  }' | jq
```

### 2. Lister les contacts
```bash
curl -s http://localhost:3000/api/contacts | jq
```

### 3. Déclencher une alerte incendie
```bash
curl -s -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"type":"feu","message":"Incendie au marché central. Évacuez immédiatement.","sendSmsAlso":true}' | jq
```

### 4. Déclencher une alerte inondation
```bash
curl -s -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"type":"eau","message":"Crue du fleuve prévue. Quittez les bas-fonds.","sendSmsAlso":false}' | jq
```

### 5. Consulter les statistiques
```bash
curl -s http://localhost:3000/api/stats | jq
```

### 6. Voir tous les appels
```bash
curl -s http://localhost:3000/api/calls | jq
```

### 7. Données carte
```bash
curl -s http://localhost:3000/api/map | jq
```

### 8. Forcer les rappels maintenant
```bash
curl -s -X POST http://localhost:3000/api/retry | jq
```

### 9. Rappeler un contact spécifique
```bash
# Récupérer l'ID d'un appel d'abord
CALL_ID=$(curl -s http://localhost:3000/api/calls | jq -r '.[0].id')
curl -s -X POST http://localhost:3000/api/calls/$CALL_ID/retry | jq
```

### 10. Envoyer un SMS manuel
```bash
curl -s -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+22676000001","message":"Test SMS alerte","dongle":"dongle0"}' | jq
```

---

## 🗺️ Tuiles offline (100% offline)

```bash
# Installer osmium et tile-dl
pip3 install tiledownloader

# Télécharger les tuiles zoom 10-15 pour Bobo-Dioulasso
python3 -c "
import urllib.request, os, time
tiles_dir = 'frontend/tiles'
# Zone: lat 11.0-11.4, lng -4.5 to -4.0
# Pour un outil plus complet, utiliser: https://github.com/jimutt/tiles-to-tiff
# ou JOSM avec plugin 'Offline maps'
print('Voir README pour les outils de tuiles offline')
"
```

Pour les tuiles offline complètes, utiliser **QGIS** ou **MapTiler** :
```bash
# Alternative simple : utiliser un fond de carte PNG statique
# ou OpenStreetMap téléchargé avec wget
```

---

## 🔍 Diagnostic

```bash
# État des dongles
asterisk -rx 'dongle show devices'

# Recharger la config Asterisk
asterisk -rx 'module reload'
asterisk -rx 'dongle reload'

# Logs en temps réel
journalctl -u alert-platform -f
tail -f /var/log/asterisk/full

# Tester un appel manuel depuis Asterisk
asterisk -rx 'originate Dongle/dongle0/+22676000001 extension s@alert-outbound'

# Vérifier l'AMI
telnet 127.0.0.1 5038
# Tapez : Action: Login\r\nUsername: alertadmin\r\nSecret: alertpass123\r\n\r\n
```

---

## 🌍 Variables d'environnement (backend)

```bash
PORT=3000                    # Port HTTP
AMI_HOST=127.0.0.1           # IP Asterisk
AMI_PORT=5038                # Port AMI
AMI_USER=alertadmin          # Utilisateur AMI
AMI_SECRET=alertpass123      # Mot de passe AMI
AGI_PORT=4573                # Port serveur AGI Node.js
DONGLES=dongle0,dongle1      # Dongles disponibles (round-robin)
MAX_ATTEMPTS=3               # Tentatives max par contact
RETRY_INTERVAL_MS=300000     # Intervalle rappels (5 min)
CALL_DELAY_MS=3000           # Délai entre appels successifs (3s)
```

---

## 📞 Flux d'appel complet

```
Node.js → AMI Originate → chan_dongle → Réseau GSM → Contact
                                                          ↓
                                              Answer() → Playback bienvenue
                                                       → Playback alerte_type
                                                       → Playback menu IVR
                                                       → Read(RESPONSE)
                                                          ↓
                                              AGI → record_response → db.json
                                                                         ↓
                                              Socket.IO → Dashboard temps réel
```
