#!/bin/bash
# ============================================================
# setup.sh — Installation complète plateforme d'alerte
# Compatible Debian/Ubuntu/Raspberry Pi OS
# Exécuter en root : sudo bash setup.sh
# ============================================================
set -e

PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== Plateforme d'alerte communautaire — Installation ==="
echo "Répertoire: $PROJ_DIR"

# ── 1. Dépendances système ────────────────────────────────────
echo "[1/7] Mise à jour système..."
apt-get update -qq
apt-get install -y -qq \
  asterisk \
  asterisk-chan-dongle \
  nodejs \
  npm \
  sox \
  libsox-fmt-mp3 \
  usb-modeswitch \
  curl \
  jq

# ── 2. Fichiers audio ─────────────────────────────────────────
echo "[2/7] Création des fichiers audio..."
AUDIO_DIR="/var/lib/asterisk/sounds/custom"
mkdir -p "$AUDIO_DIR"

# Générer des WAV de test avec sox (8kHz, mono, 16bit)
# EN PRODUCTION : remplacer par de vrais enregistrements !
generate_wav() {
  local file="$1"
  local freq="$2"
  local duration="$3"
  sox -n -r 8000 -c 1 -b 16 "$file" \
    synth "$duration" sine "$freq" vol 0.3 2>/dev/null || \
  # Fallback : créer un WAV silencieux valide
  sox -n -r 8000 -c 1 -b 16 "$file" trim 0.0 "$duration" 2>/dev/null || \
  dd if=/dev/zero bs=16000 count="$duration" 2>/dev/null | \
    sox -t raw -r 8000 -c 1 -e signed -b 16 - "$file" 2>/dev/null || true
}

# NOTE : En production, enregistrer les vrais messages :
# arecord -f S16_LE -r 8000 -c 1 /var/lib/asterisk/sounds/custom/bienvenue.wav
# Contenu suggéré pour chaque fichier :
# bienvenue.wav  : "Bonjour, vous recevez une alerte de votre communauté."
# menu.wav       : "Appuyez sur 1 si vous êtes en sécurité, 2 si vous avez besoin d'aide, 3 pour confirmer l'alerte."
# feu.wav        : "ATTENTION : Un incendie a été signalé dans votre secteur."
# eau.wav        : "ATTENTION : Une inondation est en cours dans votre zone."
# communaute.wav : "Message important de votre communauté."

generate_wav "$AUDIO_DIR/bienvenue.wav"  440 3
generate_wav "$AUDIO_DIR/menu.wav"       550 5
generate_wav "$AUDIO_DIR/feu.wav"        660 3
generate_wav "$AUDIO_DIR/eau.wav"        770 3
generate_wav "$AUDIO_DIR/communaute.wav" 880 3

chown -R asterisk:asterisk "$AUDIO_DIR"
chmod 644 "$AUDIO_DIR"/*.wav
echo "   Audio: $AUDIO_DIR"

# ── 3. Config Asterisk ────────────────────────────────────────
echo "[3/7] Configuration Asterisk..."
ASTERISK_DIR="/etc/asterisk"

# Backup
cp "$ASTERISK_DIR/extensions.conf" "$ASTERISK_DIR/extensions.conf.bak" 2>/dev/null || true
cp "$ASTERISK_DIR/sip.conf"        "$ASTERISK_DIR/sip.conf.bak"        2>/dev/null || true

# Copier nos configs
cp "$PROJ_DIR/asterisk/extensions.conf" "$ASTERISK_DIR/extensions.conf"
cp "$PROJ_DIR/asterisk/sip.conf"        "$ASTERISK_DIR/sip.conf"
cp "$PROJ_DIR/asterisk/dongle.conf"     "$ASTERISK_DIR/dongle.conf"

# Appliquer manager.conf
cat "$PROJ_DIR/asterisk/manager.conf" >> "$ASTERISK_DIR/manager.conf"

chown -R asterisk:asterisk "$ASTERISK_DIR"

# ── 4. Modules Asterisk ───────────────────────────────────────
echo "[4/7] Activation modules Asterisk..."
cat >> "$ASTERISK_DIR/modules.conf" << 'EOF'
; --- Alert platform modules ---
load => chan_dongle.so
load => res_agi.so
load => app_read.so
load => app_playback.so
load => app_originate.so
EOF

systemctl restart asterisk
sleep 3
echo "   Asterisk: $(asterisk -rx 'core show version' 2>/dev/null | head -1)"

# ── 5. Backend Node.js ────────────────────────────────────────
echo "[5/7] Installation dépendances Node.js..."
cd "$PROJ_DIR/backend"
mkdir -p data
npm install --silent

# ── 6. Leaflet offline ───────────────────────────────────────
echo "[6/7] Téléchargement Leaflet offline..."
LEAFLET_DIR="$PROJ_DIR/frontend/leaflet"
mkdir -p "$LEAFLET_DIR"

if command -v curl &>/dev/null; then
  curl -sL "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"  -o "$LEAFLET_DIR/leaflet.js"  || echo "   Leaflet JS: utilise CDN en fallback"
  curl -sL "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" -o "$LEAFLET_DIR/leaflet.css" || echo "   Leaflet CSS: utilise CDN en fallback"
  
  # Télécharger tuiles OSM pour zone Bobo-Dioulasso (zoom 10-14)
  # NOTE : Pour usage hors ligne complet, utiliser TileMill ou JOSM
  # Exemple avec wget récursif (long) :
  # mkdir -p "$PROJ_DIR/frontend/tiles"
  # python3 "$PROJ_DIR/scripts/download_tiles.py" 11.17 -4.30 11.19 -4.28 10 14
fi

# ── 7. Service systemd ────────────────────────────────────────
echo "[7/7] Création service systemd..."
cat > /etc/systemd/system/alert-platform.service << EOF
[Unit]
Description=Plateforme d'alerte communautaire
After=network.target asterisk.service

[Service]
Type=simple
WorkingDirectory=$PROJ_DIR/backend
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=5
Environment=PORT=3000
Environment=AMI_HOST=127.0.0.1
Environment=AMI_PORT=5038
Environment=AMI_USER=alertadmin
Environment=AMI_SECRET=alertpass123
Environment=AGI_PORT=4573
Environment=DONGLES=dongle0,dongle1
Environment=MAX_ATTEMPTS=3
Environment=RETRY_INTERVAL_MS=300000
Environment=CALL_DELAY_MS=3000
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable alert-platform
systemctl start alert-platform

echo ""
echo "══════════════════════════════════════════════"
echo "✅ Installation terminée !"
echo "══════════════════════════════════════════════"
echo ""
echo "  Dashboard  → http://localhost:3000"
echo ""
echo "  Vérifier les dongles GSM :"
echo "    asterisk -rx 'dongle show devices'"
echo ""
echo "  Logs :"
echo "    journalctl -u alert-platform -f"
echo "    journalctl -u asterisk -f"
echo ""
echo "  Adapter /etc/asterisk/dongle.conf"
echo "  avec les vrais ports /dev/ttyUSB* de vos modems"
echo "══════════════════════════════════════════════"
