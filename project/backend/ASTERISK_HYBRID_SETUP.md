# Configuration Asterisk (Mode Hybride VPS + Local)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VPS (Brain)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Node.js Server (Port 3000)                          │  │
│  │ ├─ alertDetector.js (NLP Classification)            │  │
│  │ ├─ alertAggregator.js (Zone-based Thresholding)     │  │
│  │ ├─ calls.js → AMI Originate                         │  │
│  │ ├─ sms.js → AMI DongleSendSMS                       │  │
│  │ └─ API Endpoints                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓ AMI TCP (Port 5038)                             │
├─────────────────────────────────────────────────────────────┤
│                    Network (SSH Tunnel recommandé)          │
├─────────────────────────────────────────────────────────────┤
│                  Local Machine (Muscles)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Asterisk Server                                     │  │
│  │ ├─ AMI Manager (Port 5038)                          │  │
│  │ ├─ chan_dongle (GSM Modems)                         │  │
│  │ │  ├─ dongle0 → /dev/ttyUSB0                        │  │
│  │ │  ├─ dongle1 → /dev/ttyUSB1                        │  │
│  │ │  └─ dongleN → /dev/ttyUSBn                        │  │
│  │ ├─ AGI Server (Port 4573)                           │  │
│  │ └─ Extensions Dialplan                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Installation Asterisk (Local)

### 1. Installer Asterisk avec chan_dongle

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential linux-headers-$(uname -r)
sudo apt-get install -y asterisk asterisk-dev

# Installer chan_dongle
cd /usr/src
sudo git clone https://github.com/alfatraining/chan_dongle.git
cd chan_dongle
sudo make
sudo make install

# Activer le module
echo "load => chan_dongle.so" | sudo tee -a /etc/asterisk/modules.conf
```

### 2. Configurer Dongle USB

```bash
# Ajouter l'utilisateur asterisk au groupe dialout
sudo usermod -a -G dialout asterisk

# Vérifier la connexion du dongle
lsusb
ls -la /dev/ttyUSB*
```

### 3. Configurer dongle.conf

```ini
[general]
interval=15
timeout=120

[dongle0]
imei=352999018801234
imsi=234123456789012
channel=Dongle/dongle0
context=from-internal
exten=s
priority=1
manufacturer=huawei
model=E220
```

### 4. Configurer manager.conf (AMI)

```ini
[general]
enabled=yes
port=5038
bindaddr=0.0.0.0
;bindaddr=127.0.0.1   ; Si uniquement local

[alertadmin]
secret=alertpass123
permit=0.0.0.0/0.0.0.0
read=all
write=all
```

### 5. Configurer extensions.conf (Dialplan)

```ini
[from-internal]
exten = s,1,Verbose(1,Alerte reçue)
exten = s,n,Playback(vm-youhave)
exten = s,n,Hangup()

[alert-outbound]
; IVR pour confirmation d'alertes
exten = s,1,PlayBack(beep)
exten = s,n,VoiceMailMain()
exten = s,n,Hangup()
```

### 6. Configurer sip.conf (optionnel, pour test local)

```ini
[general]
context=from-internal
bindport=5060

[test]
type=friend
host=dynamic
secret=test
context=from-internal
```

### 7. Démarrer Asterisk

```bash
sudo systemctl start asterisk
sudo systemctl enable asterisk

# Vérifier le statut
sudo asterisk -rvvv
# À l'intérieur:
> module show
> dongle show devices
> ami show connected
```

## Configuration VPS (Node.js)

### variables d'environnement (.env)

```env
# ── AMI (Asterisk Manager Interface) ──
AMI_HOST=127.0.0.1              # 127.0.0.1 (local) ou IP de la machine locale
AMI_PORT=5038
AMI_USER=alertadmin
AMI_SECRET=alertpass123

# ── Dongles availables ──
DONGLES=dongle0,dongle1         # Séparé par virgule

# ── AGI Server ──
AGI_PORT=4573

# ── Server HTTP ──
PORT=3000

# ── Retry Config ──
MAX_ATTEMPTS=3
RETRY_INTERVAL_MS=300000        # 5 minutes
CALL_DELAY_MS=3000              # 3 secondes entre appels
```

### Installation Node.js

```bash
cd project/backend
npm install
```

### Lancer le serveur

```bash
npm start
# Ou avec nodemon en développement:
npm run dev
```

## Connexion Sécurisée VPS ↔ Local (SSH Tunnel)

Si le VPS et la machine locale sont en réseau différent, créer un tunnel SSH:

### Sur la machine locale (Asterisk):

```bash
ssh -R 5038:127.0.0.1:5038 -R 4573:127.0.0.1:4573 user@vps.example.com
```

### Ou via systemd service (persistant):

```ini
[Unit]
Description=Asterisk SSH Tunnel to VPS
After=network.target

[Service]
Type=simple
User=asterisk
ExecStart=/usr/bin/ssh -N -R 5038:127.0.0.1:5038 -R 4573:127.0.0.1:4573 user@vps.example.com
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Sauvegarder dans `/etc/systemd/system/asterisk-tunnel.service` puis:

```bash
sudo systemctl enable asterisk-tunnel
sudo systemctl start asterisk-tunnel
```

## Test du système

### 1. Vérifier la connexion AMI

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Contact",
    "phone": "221771234567",
    "lat": 14.6788,
    "lng": -14.5116,
    "zone": "djanet"
  }'
```

### 2. Déclencher une alerte automatique (SMS Detection)

```bash
curl -X POST http://localhost:3000/api/sms/detect \
  -H "Content-Type: application/json" \
  -d '{
    "From": "+221771234567",
    "Body": "FEU BARKA incendie grave",
    "zone": "djanet"
  }'
```

### 3. Déclencher une alerte manuelle

```bash
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "type": "feu",
    "message": "Incendie à Djanet",
    "sendSmsAlso": true
  }'
```

### 4. Vérifier les stats de zones

```bash
curl http://localhost:3000/api/sms/zones?zone=djanet
```

## Dépannage

### AMI non connecté

```
⚠️ Erreur connexion Asterisk: ECONNREFUSED
```

**Solutions:**
1. Vérifier qu'Asterisk s'exécute: `asterisk -rvvv`
2. Vérifier la config AMI: `cat /etc/asterisk/manager.conf`
3. Vérifier le port et l'IP correctes
4. Ouvrir le pare-feu: `sudo ufw allow 5038` (UFW)

### Dongle non détecté

```
dongle0: no device found
```

**Solutions:**
1. Vérifier l'USB: `lsusb`
2. Vérifier les permissions: Groupe `dialout` pour Asterisk
3. Vérifier dongle.conf
4. Au démarrage d'Asterisk:
   ```bash
   module unload chan_dongle
   module load chan_dongle
   dongle discover
   ```

### SMS non envoyé

```
[SMS] ${phone} → Erreur Asterisk: Device ${dongle} not found
```

**Solutions:**
1. Vérifier le dongle configuré dans DONGLE env
2. Vérifier qu'il y a du crédit/batterie sur la carte SIM
3. Redémarrer chan_dongle:
   ```bash
   dongle reset dongle0
   ```

## Fichiers de configuration

Tous les fichiers Asterisk sont dans `project/asterisk/`:
- `dongle.conf` — Configuration des dongles
- `extensions.conf` — Dialplan (logique d'appels)
- `manager.conf` — Authentification AMI
- `sip.conf` — Configuration SIP (optionnel)

## Avantages de l'architecture hybride

✅ **Contrôle local complet** — Pas dépendant d'une API cloud
✅ **Pas d'abonnement** — Coûts réduits (juste dongles + Internet)
✅ **Multi-langue supportée** — SMS en français, Darija, Tamazight
✅ **Scalable** — Ajouter autant de dongles que nécessaire
✅ **Résilient** — Fonctionne même sans Internet pendant un temps (détection locale)
✅ **Respecte la vie privée** — Les données restent en local

## Limitation connue

⚠️ L'appel entrant via dongle GSM nécessite une gestion supplémentaire (AGI callbacks)
  Recommandation: Utiliser surtout le SMS pour les alertes
