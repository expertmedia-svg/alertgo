# 📚 Documentation Index - AlertGo Hybrid v2

**Architecture**: VPS Brain + Local Asterisk  
**Tech Stack**: Node.js + NLP + Asterisk AMI  
**Status**: ✅ Production Ready

---

## 🎯 Quick Navigation

### 👤 For first-time users
1. Start → [QUICKSTART_HYBRID.md](./QUICKSTART_HYBRID.md)
2. Setup → [ASTERISK_HYBRID_SETUP.md](./ASTERISK_HYBRID_SETUP.md)
3. Test → Run `npm start` and test `/api/sms/detect`

### 👨‍💼 For decision makers
1. Overview → [README_HYBRID_v2.md](./README_HYBRID_v2.md)
2. Why changed? → [MIGRATION_TWILIO_TO_ASTERISK.md](./MIGRATION_TWILIO_TO_ASTERISK.md)
3. Success proof → [ASTERISK_MIGRATION_COMPLETE.md](./ASTERISK_MIGRATION_COMPLETE.md)

### 👨‍💻 For developers
1. System design → [README_SYSTEM.md](./README_SYSTEM.md)
2. NLP details → [SMS_DETECTION.md](./SMS_DETECTION.md)
3. API reference → [README_SYSTEM.md](./README_SYSTEM.md#api-endpoints)
4. Config → [.env.example](./.env.example)

### 🔧 For IT/DevOps
1. Installation → [ASTERISK_HYBRID_SETUP.md](./ASTERISK_HYBRID_SETUP.md)
2. Troubleshooting → [ASTERISK_HYBRID_SETUP.md#dépannage](./ASTERISK_HYBRID_SETUP.md#dépannage)
3. Security → [ASTERISK_HYBRID_SETUP.md#sécurité](./ASTERISK_HYBRID_SETUP.md)
4. Validation → [VALIDATION_ASTERISK_MIGRATION.md](./VALIDATION_ASTERISK_MIGRATION.md)

---

## 📖 Complete document list

### Core documentation

| Doc | Audience | Read time | Purpose |
|-----|----------|-----------|---------|
| **[README_HYBRID_v2.md](./README_HYBRID_v2.md)** | Everyone | 5 min | Main overview + architecture |
| **[QUICKSTART_HYBRID.md](./QUICKSTART_HYBRID.md)** | Dev/Admin | 10 min | Get running in 2 steps |
| **[ASTERISK_HYBRID_SETUP.md](./ASTERISK_HYBRID_SETUP.md)** | Admin/DevOps | 20 min | **Complete** installation guide |
| **[SMS_DETECTION.md](./SMS_DETECTION.md)** | Developer | 15 min | NLP system explained |
| **[README_SYSTEM.md](./README_SYSTEM.md)** | Architect | 20 min | Full system design |

### Reference documentation

| Doc | Purpose | Details |
|-----|---------|---------|
| **[MIGRATION_TWILIO_TO_ASTERISK.md](./MIGRATION_TWILIO_TO_ASTERISK.md)** | Why we changed | Before/after comparison |
| **[ASTERISK_MIGRATION_COMPLETE.md](./ASTERISK_MIGRATION_COMPLETE.md)** | Success proof | Checklist + status |
| **[VALIDATION_ASTERISK_MIGRATION.md](./VALIDATION_ASTERISK_MIGRATION.md)** | Technical validation | Tests + verification |
| **[.env.example](./.env.example)** | Configuration template | All configurable vars |

---

## 🗂️ File structure

```
project/backend/
├── app.js                              # Express server + routes
├── asterisk.js                         # Asterisk AMI interface
├── calls.js                            # Call origination (AMI-based)
├── sms.js                              # SMS sending (AMI-based)
├── alertDetector.js                    # NLP classifier
├── alertAggregator.js                  # Alert threshold logic
├── retry.js                            # Retry scheduler
├── db.js                               # JSON database
├── package.json                        # Dependencies
├── .env.example                        # Configuration template
│
├── 📚 DOCUMENTATION:
├── README_HYBRID_v2.md                 # 👈 START HERE
├── QUICKSTART_HYBRID.md                # Quick 2-step guide
├── ASTERISK_HYBRID_SETUP.md            # Full install guide
├── SMS_DETECTION.md                    # NLP explained
├── README_SYSTEM.md                    # System design
├── MIGRATION_TWILIO_TO_ASTERISK.md     # Why changed
├── ASTERISK_MIGRATION_COMPLETE.md      # Success summary
├── VALIDATION_ASTERISK_MIGRATION.md    # Tests + validation
├── DOC_INDEX.md                        # 👈 YOU ARE HERE
│
└── test files:
    ├── test-detector.js                # NLP unit tests
    └── scripts/                        # Helper scripts
```

---

## ⚡ Quick commands

### Run in test mode (degraded)
```bash
cd project/backend
npm install
npm start
# Detect API works, SMS/Calls disabled
```

### Run in production (with Asterisk)
```bash
# Prerequisites: Asterisk installed on same/different machine
npm start   # With .env variables set correctly
```

### Test NLP detection
```bash
# Terminal 1: Start server
npm start

# Terminal 2: Send test SMS
curl -X POST http://localhost:3000/api/sms/detect \
  -d '{"From":"+221771234567","Body":"FEU BARKA","zone":"djanet"}'
```

### Install dependencies
```bash
npm install     # First time
npm update      # Update later
```

### View Asterisk status (after install)
```bash
asterisk -rvvv
> module show
> dongle show devices
> ami show connected
```

---

## 🎓 Learning path

### 1️⃣ Introduction (15 min)
- [ ] Read [README_HYBRID_v2.md](./README_HYBRID_v2.md)
- [ ] Understand architecture diagram
- [ ] Know why Asterisk was chosen

### 2️⃣ Quick start (30 min)
- [ ] Follow [QUICKSTART_HYBRID.md](./QUICKSTART_HYBRID.md)
- [ ] Run npm start
- [ ] Test API with curl
- [ ] See NLP classification work

### 3️⃣ Deep dive (2-3 hours)
- [ ] Read [SMS_DETECTION.md](./SMS_DETECTION.md) — NLP system
- [ ] Read [README_SYSTEM.md](./README_SYSTEM.md) — Full architecture
- [ ] Explore code: `alertDetector.js`, `alertAggregator.js`
- [ ] Understand workflow in app.js

### 4️⃣ Production (4-8 hours)
- [ ] Follow [ASTERISK_HYBRID_SETUP.md](./ASTERISK_HYBRID_SETUP.md)
- [ ] Install Asterisk on Linux machine
- [ ] Configure dongle.conf, manager.conf
- [ ] Test Asterisk AMI connection
- [ ] Deploy and monitor

### 5️⃣ Advanced (optional)
- [ ] Customize NLP keywords
- [ ] Add new alert types
- [ ] Scale to multi-dongle setup
- [ ] Add SMS transcription

---

## ❓ Common questions

### Q: Where do I start?
**A**: 
1. If you have 5 min: [QUICKSTART_HYBRID.md](./QUICKSTART_HYBRID.md)
2. If you have 30 min: [README_HYBRID_v2.md](./README_HYBRID_v2.md) + QUICKSTART
3. If installing: [ASTERISK_HYBRID_SETUP.md](./ASTERISK_HYBRID_SETUP.md)

### Q: How is this different from Twilio?
**A**: See [MIGRATION_TWILIO_TO_ASTERISK.md](./MIGRATION_TWILIO_TO_ASTERISK.md)

### Q: Can I run this without Asterisk?
**A**: Yes! Mode degraded works (SMS/Calls disabled, detection OK)

### Q: What languages are supported?
**A**: French, Darija, Tamazight. See [SMS_DETECTION.md](./SMS_DETECTION.md#multi-language-support)

### Q: How do I troubleshoot?
**A**: See [ASTERISK_HYBRID_SETUP.md#dépannage](./ASTERISK_HYBRID_SETUP.md#dépannage)

### Q: Where's the API documentation?
**A**: [README_SYSTEM.md#api-endpoints](./README_SYSTEM.md#api-endpoints)

### Q: Can I modify NLP keywords?
**A**: Yes! Edit `alertDetector.js`. See [SMS_DETECTION.md#customization](./SMS_DETECTION.md#customization)

---

## 🔗 External resources

- **Asterisk documentation**: https://wiki.asterisk.org
- **chan_dongle GitHub**: https://github.com/alfatraining/chan_dongle
- **Node.js**: https://nodejs.org
- **Socket.IO**: https://socket.io

---

## 📞 Support

### For setup issues
→ [ASTERISK_HYBRID_SETUP.md#dépannage](./ASTERISK_HYBRID_SETUP.md#dépannage)

### For API questions
→ [README_SYSTEM.md#api](./README_SYSTEM.md)

### For NLP/detection
→ [SMS_DETECTION.md](./SMS_DETECTION.md)

### For architecture
→ [README_SYSTEM.md#architecture](./README_SYSTEM.md#architecture)

### For new feature requests
→ Check [ASTERISK_HYBRID_SETUP.md#avantages](./ASTERISK_HYBRID_SETUP.md#avantages-de-larchitecture-hybride)

---

## ✅ Checklist before production

- [ ] Read [README_HYBRID_v2.md](./README_HYBRID_v2.md)
- [ ] Followed [QUICKSTART_HYBRID.md](./QUICKSTART_HYBRID.md)
- [ ] Can run `npm start` successfully
- [ ] Can test `/api/sms/detect` endpoint
- [ ] Installed Asterisk (prod only)
- [ ] Configured .env file
- [ ] Tested AMI connection
- [ ] Verified SMS works
- [ ] Verified calls work
- [ ] Read [VALIDATION_ASTERISK_MIGRATION.md](./VALIDATION_ASTERISK_MIGRATION.md)

---

## 📊 Documentation statistics

| Category | Count | Total read time |
|----------|-------|-----------------|
| Core docs | 5 | 40 min |
| Reference | 5 | 30 min |
| Code comments | 100+ | 15 min |
| Examples | 20+ | 10 min |
| **Total** | **130+** | **95 min** |

---

**Last updated**: 2025  
**Status**: ✅ Complete & Production Ready  
**Next review**: After first production deployment

---

**Start here**: → [QUICKSTART_HYBRID.md](./QUICKSTART_HYBRID.md) 🚀
