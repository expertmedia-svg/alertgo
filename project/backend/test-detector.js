#!/usr/bin/env node

// ============================================================
// test-detector.js — Tests de la détection d'alertes
// ============================================================
// Usage: node test-detector.js

const alertDetector = require('./alertDetector');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   TEST SYSTÈME DE DÉTECTION D\'ALERTES SMS                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test cases
const testCases = [
  // === FEU ===
  { text: 'FEU BARKA', expected: 'feu', zone: 'djanet' },
  { text: 'incendie route', expected: 'feu', zone: 'djanet' },
  { text: 'brûle le forage', expected: 'feu', zone: null },
  { text: 'nar djina', expected: 'feu', zone: 'illizi' },
  { text: 'feu danger urgent', expected: 'feu', zone: 'djanet' },
  { text: 'hsara kbira', expected: 'feu', zone: 'djanet' },

  // === EAU ===
  { text: 'noyade', expected: 'eau', zone: 'touggourt' },
  { text: 'inondation route', expected: 'eau', zone: 'n\'djamena' },
  { text: 'eau saleee', expected: 'eau', zone: 'djanet' },  // typo
  { text: 'tarik dguej', expected: 'eau', zone: 'ghardaia' },
  { text: 'submergé', expected: 'eau', zone: null },

  // === SÉCURITÉ ===
  { text: 'accident route', expected: 'sécurité', zone: 'djanet' },
  { text: 'blessé danger', expected: 'sécurité', zone: null },
  { text: 'violence agression', expected: 'sécurité', zone: 'illizi' },
  { text: 'collision route', expected: 'sécurité', zone: 'djanet' },
  { text: 'djina kbira', expected: 'sécurité', zone: 'djanet' },

  // === INFRASTRUCTURE ===
  { text: 'forage cassé', expected: 'infrastructure', zone: 'djanet' },
  { text: 'route brisée', expected: 'infrastructure', zone: 'ghardaia' },
  { text: 'panne électricité', expected: 'infrastructure', zone: null },
  { text: 'coupure eau réseau', expected: 'infrastructure', zone: 'djanet' },
  { text: 'pont route', expected: 'infrastructure', zone: 'illizi' },

  // === SPAM ===
  { text: 'promo gratuit achat', expected: 'spam', zone: null },
  { text: 'test blague demo', expected: 'spam', zone: 'djanet' },

  // === AUTRE / NÉGATIF ===
  { text: 'pas de feu', expected: 'autre', zone: 'djanet' },
  { text: 'bonjour', expected: 'autre', zone: null },
  { text: '', expected: 'autre', zone: 'djanet' },
];

// Résultats
let passed = 0;
let failed = 0;

// Tester chaque cas
console.log('Tests:\n');
testCases.forEach((test, i) => {
  const result = alertDetector.classifyMessage(test.text, test.zone);
  const success = result.type === test.expected;

  if (success) {
    passed++;
    console.log(`✅ Test ${i + 1}: "${test.text}"`);
    console.log(`   Type: ${result.type} (confiance: ${(result.confidence * 100).toFixed(0)}%)`);
  } else {
    failed++;
    console.log(`❌ Test ${i + 1}: "${test.text}"`);
    console.log(`   Attendu: ${test.expected}, Obtenu: ${result.type}`);
    console.log(`   Confiance: ${(result.confidence * 100).toFixed(0)}%`);
    if (result.keywords_found.length > 0) {
      console.log(`   Keywords: ${result.keywords_found.join(', ')}`);
    }
  }
  console.log();
});

// Résumé
console.log('╔════════════════════════════════════════════════════════════╗');
console.log(`║  RÉSULTATS: ${passed} PASSÉS, ${failed} ÉCHOUÉS (${testCases.length} tests)        ║`);
const rate = ((passed / testCases.length) * 100).toFixed(0);
console.log(`║  Taux de réussite: ${rate}%                                           ║`);
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Détails
if (failed === 0) {
  console.log('🎉 TOUS LES TESTS SONT PASSÉS!\n');
} else {
  console.log(`⚠️  ${failed} test(s) échoué(s). Vérifier les keywords.\n`);
}

// Bonus: Tester avec plusieurs messages (agrégation)
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   TESTS D\'AGRÉGATION (classifyMultiple)                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const multiTest = [
  'FEU BARKA',
  'incendie danger',
  'nar djina urgent'
];

const multiResult = alertDetector.classifyMultiple(multiTest);
console.log(`Messages: ${multiTest.join(' | ')}`);
console.log(`Type détecté: ${multiResult.type}`);
console.log(`Confiance moyenne: ${(multiResult.confidence * 100).toFixed(0)}%`);
console.log(`Détails:`);
multiResult.details.forEach(d => {
  console.log(`  - "${d.raw_text}" → ${d.type} (${(d.confidence * 100).toFixed(0)}%)`);
});

console.log('\n✅ Tests terminés!\n');
