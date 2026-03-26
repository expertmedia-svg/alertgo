// ============================================================
// alertDetector.js — NLP léger pour classification SMS
// ============================================================
// Détecte les alertes dans les SMS (FEU, EAU, SÉCURITÉ, AUTRE)
// Optimisé pour fonctionner OFFLINE avec faible connectivité
// Support: Français + Dialectal (Darija, Tamazight)

const Fuse = require('fuse.js');  // Pour fuzzy matching (typos)

// ── Keywords par catégorie avec poids ─────────────────────
const ALERT_KEYWORDS = {
  feu: {
    weight: 1.0,
    keywords: [
      'feu', 'incendie', 'brûle', 'flamme', 'fumer',
      'barka', 'nar', 'hsara',  // Darija
      'afs', 'arur'              // Tamazight
    ]
  },
  eau: {
    weight: 0.9,
    keywords: [
      'eau', 'noyade', 'inondation', 'inondé', 'submergé',
      'tarik', 'aaas', 'dguej',  // Darija
      'aman', 'saman'            // Tamazight
    ]
  },
  sécurité: {
    weight: 0.95,
    keywords: [
      'accident', 'blessé', 'collision', 'crash', 'violence',
      'vol', 'agression', 'danger', 'danger', 'urgence',
      'djina', 'tahlif', 'hdiqa',  // Darija
      'afegli', 'tamest'           // Tamazight
    ]
  },
  infrastructure: {
    weight: 0.85,
    keywords: [
      'route', 'pont', 'forage', 'cassé', 'brisé', 'panne',
      'électricité', 'eau', 'électrique', 'coupure',
      'sbar', 'kadra', 'talsa',  // Darija
      'agadir', 'takarbutz'      // Tamazight
    ]
  }
};

// ── Mots de négation à éviter ─────────────────────────────
const NEGATION_KEYWORDS = [
  'pas', 'aucun', 'jamais', 'ne ', 'non ', 'walou', 'bezzaf'
];

// ── Mots de spam ──────────────────────────────────────────
const SPAM_KEYWORDS = [
  'promo', 'achat', 'vente', 'prix', 'gratuit',
  'blague', 'test', 'demo', 'verification'
];

/**
 * Normaliser le texte (lowercase, accents, espaces)
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[ïî]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/\s+/g, ' ');  // Espaces multiples → simple
}

/**
 * Déterminer si le message est du spam
 */
function isSpam(text) {
  const normalized = normalizeText(text);
  return SPAM_KEYWORDS.some(word => normalized.includes(word));
}

/**
 * Déterminer si le message a une négation
 */
function hasNegation(text) {
  const normalized = normalizeText(text);
  return NEGATION_KEYWORDS.some(neg => {
    const regex = new RegExp(`\\b${neg}\\b`, 'i');
    return regex.test(normalized);
  });
}

/**
 * Fuzzy matching pour gérer les typos
 * Ex: "feu" vs "feus", "barka" vs "bark"
 */
function fuzzyMatch(text, keywords, threshold = 0.7) {
  const fuse = new Fuse(keywords, { threshold: 1 - threshold });
  const results = fuse.search(text);
  return results.length > 0 ? results[0].score : 0;
}

/**
 * Classifier un SMS
 * @param {string} text - Texte du SMS
 * @param {string} zone - Zone géographique (optionnel)
 * @returns {object} { type, confidence, score, keywords_found }
 */
function classifyMessage(text, zone = null) {
  if (!text || text.trim().length === 0) {
    return { type: 'autre', confidence: 0, reason: 'empty' };
  }

  // Anti-spam
  if (isSpam(text)) {
    return { type: 'spam', confidence: 0.95, reason: 'spam_keywords' };
  }

  const normalized = normalizeText(text);
  const scores = {};
  const foundKeywords = {};

  // Calculer le score pour chaque catégorie
  for (const [alertType, config] of Object.entries(ALERT_KEYWORDS)) {
    let typeScore = 0;
    const found = [];

    for (const keyword of config.keywords) {
      if (normalized.includes(keyword)) {
        // Boost si mot exact (entre espaces)
        const exactRegex = new RegExp(`\\b${keyword}\\b`);
        const isExact = exactRegex.test(normalized);
        
        typeScore += isExact ? config.weight : config.weight * 0.7;
        found.push(keyword);
      }
    }

    // Fuzzy matching pour typos légers
    if (typeScore === 0) {
      const fuzzyScore = fuzzyMatch(normalized, config.keywords, 0.75);
      if (fuzzyScore > 0.5) {
        typeScore = config.weight * (1 - fuzzyScore);
      }
    }

    scores[alertType] = typeScore;
    foundKeywords[alertType] = found;
  }

  // Pénalité si négation
  if (hasNegation(text)) {
    Object.keys(scores).forEach(key => {
      scores[key] *= 0.5;
    });
  }

  // Trouver la meilleure catégorie
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const [detectedType, score] = best || ['autre', 0];

  // Normaliser la confiance entre 0 et 1
  const confidence = Math.min(score / 1.0, 1.0);

  return {
    type: confidence > 0.3 ? detectedType : 'autre',
    confidence: parseFloat(confidence.toFixed(2)),
    score: parseFloat(score.toFixed(3)),
    keywords_found: foundKeywords[detectedType] || [],
    raw_text: text,
    normalized: normalized,
    zone: zone
  };
}

/**
 * Analyser plusieurs SMS et retourner le type d'alerte dominant
 */
function classifyMultiple(messages) {
  const results = messages.map(msg => classifyMessage(msg));
  
  // Moyenne pondérée des scores
  const typeScores = {};
  results.forEach(r => {
    typeScores[r.type] = (typeScores[r.type] || 0) + r.confidence;
  });

  const bestType = Object.entries(typeScores).sort((a, b) => b[1] - a[1])[0];
  
  return {
    type: bestType[0],
    confidence: (bestType[1] / results.length).toFixed(2),
    count: results.length,
    details: results
  };
}

module.exports = {
  classifyMessage,
  classifyMultiple,
  normalizeText,
  isSpam,
  ALERT_KEYWORDS
};
