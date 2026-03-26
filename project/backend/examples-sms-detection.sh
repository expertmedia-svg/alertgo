#!/usr/bin/env bash

# ============================================================
# examples-sms-detection.sh — Exemples de requêtes API
# ============================================================
# Usage: bash examples-sms-detection.sh

API_URL="http://localhost:3000"

echo "════════════════════════════════════════════════════════════"
echo "  EXEMPLES DE DÉTECTION D'ALERTES SMS"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── Test 1: SMS simple (count=1) ─────────────────────────────
echo "▶ Test 1: SMS FEU simple (1/3)"
echo "─────────────────────────────────────────────────────────"
curl -s -X POST "$API_URL/api/sms/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "+33612345678",
    "Body": "FEU BARKA",
    "zone": "djanet"
  }' | jq '.'
echo ""
echo "Status: 1 message / 3 requis (pas trigger)"
echo ""
sleep 2

# ── Test 2: Deuxième SMS (count=2) ───────────────────────────
echo "▶ Test 2: SMS incendie (2/3)"
echo "─────────────────────────────────────────────────────────"
curl -s -X POST "$API_URL/api/sms/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "+33687654321",
    "Body": "incendie danger route",
    "zone": "djanet"
  }' | jq '.'
echo ""
echo "Status: 2 messages / 3 requis (pas trigger)"
echo ""
sleep 2

# ── Test 3: Troisième SMS → DÉCLENCHE ALERTE AUTO! ──────────
echo "▶ Test 3: SMS Darija (3/3) → 🚨 DÉCLENCHE ALERTE AUTO"
echo "─────────────────────────────────────────────────────────"
curl -s -X POST "$API_URL/api/sms/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "+33699999999",
    "Body": "nar djina kbira f djanet",
    "zone": "djanet"
  }' | jq '.'
echo ""
echo "Status: 3 messages / 3 requis → ALERTE AUTOMATIQUE DÉCLENCHÉE!"
echo "  → Alerte créée: AUTO_FEU"
echo "  → Appels lancés vers tous les contacts de djanet"
echo ""
sleep 2

# ── Test 4: Voir le statut de la zone ────────────────────────
echo "▶ Test 4: Voir le statut de la zone djanet"
echo "─────────────────────────────────────────────────────────"
curl -s "$API_URL/api/sms/zones?zone=djanet" | jq '.'
echo ""
sleep 2

# ── Test 5: Dashboard global ─────────────────────────────────
echo "▶ Test 5: Dashboard global"
echo "─────────────────────────────────────────────────────────"
curl -s "$API_URL/api/sms/dashboard" | jq '.'
echo ""
sleep 2

# ── Test 6: Test EAU (pour une autre zone) ───────────────────
echo "▶ Test 6: SMS INONDATION (zone ghardaia)"
echo "─────────────────────────────────────────────────────────"

for i in {1..3}; do
  echo "  Message $i/3..."
  curl -s -X POST "$API_URL/api/sms/detect" \
    -H "Content-Type: application/json" \
    -d "{
      \"From\": \"+336111111$i\",
      \"Body\": \"$([ $i -eq 1 ] && echo 'inondation' || [ $i -eq 2 ] && echo 'tarik dguej' || echo 'noyade danger')\",
      \"zone\": \"ghardaia\"
    }" > /dev/null
  sleep 1
done

echo "  → Vérification du résultat..."
curl -s "$API_URL/api/sms/zones?zone=ghardaia" | jq '.alerts.eau'
echo ""
sleep 2

# ── Test 7: Test SÉCURITÉ (pour une autre zone) ──────────────
echo "▶ Test 7: SMS ACCIDENT (zone illizi)"
echo "─────────────────────────────────────────────────────────"

for i in {1..3}; do
  echo "  Message $i/3..."
  curl -s -X POST "$API_URL/api/sms/detect" \
    -H "Content-Type: application/json" \
    -d "{
      \"From\": \"+336222222$i\",
      \"Body\": \"$([ $i -eq 1 ] && echo 'accident route' || [ $i -eq 2 ] && echo 'collision urgent' || echo 'blessé danger')\",
      \"zone\": \"illizi\"
    }" > /dev/null
  sleep 1
done

echo "  → Vérification du résultat..."
curl -s "$API_URL/api/sms/zones?zone=illizi" | jq '.alerts.sécurité'
echo ""
sleep 2

# ── Test 8: Test SPAM (doit être rejeté) ────────────────────
echo "▶ Test 8: SMS SPAM (doit être classé comme spam)"
echo "─────────────────────────────────────────────────────────"
curl -s -X POST "$API_URL/api/sms/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "+33633333333",
    "Body": "PROMO GRATUIT ACHAT MAINTENANT",
    "zone": "djanet"
  }' | jq '.classification'
echo ""

# ── Test 9: Test NÉGATION (doit reducer le score) ────────────
echo "▶ Test 9: SMS avec négation (doit réduire confiance)"
echo "─────────────────────────────────────────────────────────"
curl -s -X POST "$API_URL/api/sms/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "+33644444444",
    "Body": "pas de feu pas danger",
    "zone": "djanet"
  }' | jq '.classification'
echo ""

# ── Test 10: Test TYPO (fuzzy matching) ──────────────────────
echo "▶ Test 10: SMS avec typo (fuzzy matching)"
echo "─────────────────────────────────────────────────────────"
curl -s -X POST "$API_URL/api/sms/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "+33655555555",
    "Body": "eau saleee feu",
    "zone": "djanet"
  }' | jq '.classification'
echo ""

# ── RÉSUMÉ ───────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════"
echo "  RÉSUMÉ DES TESTS"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "✅ Tests effectués:"
echo "  • SMS simple (1/3)"
echo "  • SMS deuxième (2/3)"
echo "  • SMS qui déclenche alerte AUTO (3/3)"
echo "  • Voir statut zone"
echo "  • Dashboard global"
echo "  • Alerte EAU (3 messages, zone ghardaia)"
echo "  • Alerte SÉCURITÉ (3 messages, zone illizi)"
echo "  • SMS SPAM (rejeté)"
echo "  • SMS avec NÉGATION (confiance réduite)"
echo "  • SMS avec TYPO (fuzzy matching)"
echo ""
echo "✅ Vérifications:"
echo ""

echo "Zones actives:"
curl -s "$API_URL/api/sms/dashboard" | jq '.detection_stats'
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ Tests complétés!"
echo "════════════════════════════════════════════════════════════"
