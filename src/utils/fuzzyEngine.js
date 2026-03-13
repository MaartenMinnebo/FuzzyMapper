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

function tokenScore(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const mapB = new Map(tokensB.map(({ token, weight }) => [token, weight]));

  let matchedWeight = 0;
  let totalWeightA = 0;
  for (const { token, weight } of tokensA) {
    totalWeightA += weight;
    if (mapB.has(token)) {
      matchedWeight += weight;
    } else {
      for (const [bToken, bWeight] of mapB) {
        if (bToken.includes(token) || token.includes(bToken)) {
          matchedWeight += Math.min(weight, bWeight) * 0.7;
          break;
        }
      }
    }
  }
  let totalWeightB = 0;
  for (const { weight } of tokensB) totalWeightB += weight;
  const union = totalWeightA + totalWeightB - matchedWeight;
  return union > 0 ? matchedWeight / union : 0;
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
    const combined = tScore * 0.70 + fScore * 0.30;
    return { item, score: combined, tokenScore: tScore };
  });

  return scored
    .filter(r => r.score > threshold * 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
