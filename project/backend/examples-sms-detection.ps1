# ============================================================
# examples-sms-detection.ps1 — Exemples pour Windows PowerShell
# ============================================================
# Usage: .\examples-sms-detection.ps1

$ApiUrl = "http://localhost:3000"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  EXEMPLES DE DÉTECTION D'ALERTES SMS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Test 1: SMS simple (count=1) ─────────────────────────────
Write-Host "▶ Test 1: SMS FEU simple (1/3)" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$body1 = @{
    From = "+33612345678"
    Body = "FEU BARKA"
    zone = "djanet"
} | ConvertTo-Json

$result1 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/detect" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body1

Write-Host ($result1.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3)
Write-Host "Status: 1 message / 3 requis (pas trigger)" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 2

# ── Test 2: Deuxième SMS (count=2) ───────────────────────────
Write-Host "▶ Test 2: SMS incendie (2/3)" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$body2 = @{
    From = "+33687654321"
    Body = "incendie danger route"
    zone = "djanet"
} | ConvertTo-Json

$result2 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/detect" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body2

Write-Host ($result2.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3)
Write-Host "Status: 2 messages / 3 requis (pas trigger)" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 2

# ── Test 3: Troisième SMS → DÉCLENCHE ALERTE AUTO! ──────────
Write-Host "▶ Test 3: SMS Darija (3/3) → ⚨ DÉCLENCHE ALERTE AUTO" -ForegroundColor Red
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$body3 = @{
    From = "+33699999999"
    Body = "nar djina kbira f djanet"
    zone = "djanet"
} | ConvertTo-Json

$result3 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/detect" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body3

Write-Host ($result3.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3)
Write-Host "Status: 3 messages / 3 requis → ALERTE AUTOMATIQUE DÉCLENCHÉE!" -ForegroundColor Red
Write-Host "  → Alerte créée: AUTO_FEU" -ForegroundColor Red
Write-Host "  → Appels lancés vers tous les contacts de djanet" -ForegroundColor Red
Write-Host ""
Start-Sleep -Seconds 2

# ── Test 4: Voir le statut de la zone ────────────────────────
Write-Host "▶ Test 4: Voir le statut de la zone djanet" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$result4 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/zones?zone=djanet" -Method Get
Write-Host ($result4.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3)
Write-Host ""
Start-Sleep -Seconds 2

# ── Test 5: Dashboard global ─────────────────────────────────
Write-Host "▶ Test 5: Dashboard global" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$result5 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/dashboard" -Method Get
Write-Host ($result5.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3)
Write-Host ""
Start-Sleep -Seconds 2

# ── Test 6: Test EAU (pour une autre zone) ───────────────────
Write-Host "▶ Test 6: SMS INONDATION (zone ghardaia)" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$waterMessages = @("inondation", "tarik dguej", "noyade danger")

for ($i = 0; $i -lt 3; $i++) {
    Write-Host "  Message $(($i+1))/3..."
    $body = @{
        From = "+336111111$(($i+1))"
        Body = $waterMessages[$i]
        zone = "ghardaia"
    } | ConvertTo-Json

    $null = Invoke-WebRequest -Uri "$ApiUrl/api/sms/detect" `
      -Method Post `
      -Headers @{"Content-Type"="application/json"} `
      -Body $body -UseBasicParsing

    Start-Sleep -Seconds 1
}

Write-Host "  → Vérification du résultat..."
$result6 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/zones?zone=ghardaia" -Method Get
$json = $result6.Content | ConvertFrom-Json
Write-Host ($json.alerts.eau | ConvertTo-Json)
Write-Host ""
Start-Sleep -Seconds 2

# ── Test 7: Test SÉCURITÉ (pour une autre zone) ──────────────
Write-Host "▶ Test 7: SMS ACCIDENT (zone illizi)" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$safetyMessages = @("accident route", "collision urgent", "blessé danger")

for ($i = 0; $i -lt 3; $i++) {
    Write-Host "  Message $(($i+1))/3..."
    $body = @{
        From = "+336222222$(($i+1))"
        Body = $safetyMessages[$i]
        zone = "illizi"
    } | ConvertTo-Json

    $null = Invoke-WebRequest -Uri "$ApiUrl/api/sms/detect" `
      -Method Post `
      -Headers @{"Content-Type"="application/json"} `
      -Body $body -UseBasicParsing

    Start-Sleep -Seconds 1
}

Write-Host "  → Vérification du résultat..."
$result7 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/zones?zone=illizi" -Method Get
$json = $result7.Content | ConvertFrom-Json
Write-Host ($json.alerts.sécurité | ConvertTo-Json)
Write-Host ""
Start-Sleep -Seconds 2

# ── Test 8: Test SPAM (doit être rejeté) ────────────────────
Write-Host "▶ Test 8: SMS SPAM (doit être classé comme spam)" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$body8 = @{
    From = "+33633333333"
    Body = "PROMO GRATUIT ACHAT MAINTENANT"
    zone = "djanet"
} | ConvertTo-Json

$result8 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/detect" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body8

$json = $result8.Content | ConvertFrom-Json
Write-Host ($json.classification | ConvertTo-Json)
Write-Host ""

# ── Test 9: Test NÉGATION ────────────────────────────────────
Write-Host "▶ Test 9: SMS avec négation (doit réduire confiance)" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$body9 = @{
    From = "+33644444444"
    Body = "pas de feu pas danger"
    zone = "djanet"
} | ConvertTo-Json

$result9 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/detect" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body9

$json = $result9.Content | ConvertFrom-Json
Write-Host ($json.classification | ConvertTo-Json)
Write-Host ""

# ── Test 10: Test TYPO ───────────────────────────────────────
Write-Host "▶ Test 10: SMS avec typo (fuzzy matching)" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray

$body10 = @{
    From = "+33655555555"
    Body = "eau saleee feu"
    zone = "djanet"
} | ConvertTo-Json

$result10 = Invoke-WebRequest -Uri "$ApiUrl/api/sms/detect" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body10

$json = $result10.Content | ConvertFrom-Json
Write-Host ($json.classification | ConvertTo-Json)
Write-Host ""

# ── RÉSUMÉ ───────────────────────────────────────────────────
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ DES TESTS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Tests effectués:" -ForegroundColor Green
Write-Host "  • SMS simple (1/3)" -ForegroundColor Green
Write-Host "  • SMS deuxième (2/3)" -ForegroundColor Green
Write-Host "  • SMS qui déclenche alerte AUTO (3/3)" -ForegroundColor Green
Write-Host "  • Voir statut zone" -ForegroundColor Green
Write-Host "  • Dashboard global" -ForegroundColor Green
Write-Host "  • Alerte EAU (3 messages, zone ghardaia)" -ForegroundColor Green
Write-Host "  • Alerte SÉCURITÉ (3 messages, zone illizi)" -ForegroundColor Green
Write-Host "  • SMS SPAM (rejeté)" -ForegroundColor Green
Write-Host "  • SMS avec NÉGATION (confiance réduite)" -ForegroundColor Green
Write-Host "  • SMS avec TYPO (fuzzy matching)" -ForegroundColor Green
Write-Host ""

Write-Host "Zones actives:" -ForegroundColor Yellow
$result = Invoke-WebRequest -Uri "$ApiUrl/api/sms/dashboard" -Method Get
$json = $result.Content | ConvertFrom-Json
Write-Host ($json.detection_stats | ConvertTo-Json)
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Tests complétés!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
