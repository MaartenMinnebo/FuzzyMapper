import Fuse from 'fuse.js';

// ============================================================
//  MATCHING ENGINE – Hybrid: token-based (primary) + Fuse.js
// ============================================================

const STOP_WORDS = new Set([
  'de', 'het', 'een', 'en', 'of', 'met', 'voor', 'van', 'bij', 'in', 'op',
  'aan', 'als', 'te', 'tot', 'om', 'uit', 'door', 'per', 'over', 'naar',
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'to', 'on',
  'type', 'soort', 'apparaat', 'toestel', 'set', 'kit',
]);

export function tokenize(str) {
  if (!str) return [];
  const cleaned = str
    .replace(/[-+;:,[\]()/\\|&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = [];
  for (const raw of cleaned.split(' ').filter(t => t.length >= 2)) {
    const lower = raw.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    const hasDigit = /\d/.test(raw);
    const hasUpperMid = /[A-Z]/.test(raw.slice(1));
    const isFullUpper = raw === raw.toUpperCase() && raw.length >= 3;
    const startsUpper = /^[A-Z]/.test(raw);
    const isAlphaNumeric = /^[A-Za-z0-9.]+$/.test(raw) && hasDigit;

    let weight = 1;
    if (isAlphaNumeric) weight = 4;
    else if (isFullUpper && raw.length >= 3) weight = 3;
    else if (hasUpperMid) weight = 3;
    else if (startsUpper) weight = 2;
    tokens.push({ token: lower, weight });
  }
  return tokens;
}

export function tokenScore(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;

  // tokensB can be treated as a "bag of weights" to pull from
  const mapB = new Map();
  for (const { token, weight } of tokensB) {
    mapB.set(token, (mapB.get(token) || 0) + weight);
  }

  let matchedWeight = 0;
  let totalWeightA = 0;
  for (const { token, weight } of tokensA) {
    totalWeightA += weight;
    
    // 1. Try exact match
    if (mapB.has(token)) {
      const avail = mapB.get(token);
      const match = Math.min(weight, avail);
      matchedWeight += match;
      if (avail - match <= 0) mapB.delete(token);
      else mapB.set(token, avail - match);
    } 
    // 2. Try substring match if no exact match or leftover weight
    else {
      for (const [bToken, bWeight] of mapB) {
        if (bToken.includes(token) || token.includes(bToken)) {
          const match = Math.min(weight, bWeight);
          matchedWeight += match * 0.7;
          if (bWeight - match <= 0) mapB.delete(bToken);
          else mapB.set(bToken, bWeight - match);
          break;
        }
      }
    }
  }

  let totalWeightB = 0;
  for (const { weight } of tokensB) totalWeightB += weight;

  // Jaccard similarity: intersection / union
  // union = A + B - intersection
  const union = totalWeightA + totalWeightB - matchedWeight;
  return union > 0 ? Math.min(1, matchedWeight / union) : 0;
}

export function buildFuseIndex(targetList) {
  // Pre-tokenize
  targetList.forEach(item => {
    if (!item._tokens) item._tokens = tokenize(item.omschrijving);
  });
  return new Fuse(targetList, {
    keys: ['omschrijving'],
    includeScore: true,
    threshold: 0.9,
    ignoreLocation: true,
    minMatchCharLength: 2,
    findAllMatches: true,
  });
}

export function searchMatches(query, targetList, fuse, { threshold = 0.4, maxResults = 5 } = {}) {
  if (!query || !targetList.length) return [];
  const queryTokens = tokenize(query);

  const fuseResults = fuse ? fuse.search(query) : [];
  const fuseScoreMap = new Map(fuseResults.map(r => [r.item.uuid, 1 - r.score]));

  const scored = targetList.map(item => {
    const tScore = tokenScore(queryTokens, item._tokens || []);
    const fScore = fuseScoreMap.get(item.uuid) || 0;
    let combined = tScore * 0.70 + fScore * 0.30;
    if (combined > 0.999) combined = 1; // Clamp near-perfect matches
    return { item, score: combined, tokenScore: tScore };
  });

  return scored
    .filter(r => r.score > threshold * 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
