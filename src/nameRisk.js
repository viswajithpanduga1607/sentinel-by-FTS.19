// nameRisk.js: flags look-alike package names (typosquatting) by comparing a
// dependency name against a list of popular packages. checkName is a pure
// function; the only I/O is loading the default seed list once at startup.

const DEFAULT_POPULAR = require('../data/popular-npm.json');

const SEPARATORS = /[-_.]/g;

// Staggered QWERTY rows. A key's neighbours are the keys beside it, the two
// keys touching it in the row above and the two in the row below.
const KEYBOARD_ROWS = ['1234567890-', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KEYBOARD_NEIGHBOURS = buildKeyboardNeighbours(KEYBOARD_ROWS);

// Base scores per finding, before metadata adjustments.
const SCORES = {
  swap: 75,
  keyboard: 70,
  missing: 70,
  doubled: 70,
  separator: 65,
  substitution: 55,
  extra: 55,
  twoEdits: 40,
};

function buildKeyboardNeighbours(rows) {
  const neighbours = new Map();
  rows.forEach((row, r) => {
    [...row].forEach((key, c) => {
      const near = [row[c - 1], row[c + 1]];
      if (r > 0) near.push(rows[r - 1][c], rows[r - 1][c + 1]);
      if (r < rows.length - 1) near.push(rows[r + 1][c - 1], rows[r + 1][c]);
      neighbours.set(key, new Set(near.filter(Boolean)));
    });
  });
  return neighbours;
}

function isKeyboardAdjacent(a, b) {
  const near = KEYBOARD_NEIGHBOURS.get(a);
  return Boolean(near && near.has(b));
}

// Damerau-Levenshtein distance (optimal string alignment variant): counts
// insertions, deletions, substitutions and swaps of two adjacent characters.
function damerauLevenshtein(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) {
    d.push([i]);
  }
  for (let j = 1; j <= b.length; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Short names collide by chance, so allow fewer edits the shorter the
// popular name is. Names of one or two characters only get the separator rule.
function maxDistanceFor(intended) {
  if (intended.length <= 2) return 0;
  if (intended.length <= 5) return 1;
  return 2;
}

function firstDifference(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Explains a name that is exactly one edit away from the intended name.
function describeSingleEdit(name, intended) {
  const i = firstDifference(name, intended);

  if (name.length === intended.length) {
    if (name[i + 1] === intended[i] && name[i] === intended[i + 1] && name.slice(i + 2) === intended.slice(i + 2)) {
      return {
        score: SCORES.swap,
        reason: `Looks like "${intended}" with two adjacent letters swapped ("${intended.slice(i, i + 2)}" became "${name.slice(i, i + 2)}").`,
      };
    }
    if (isKeyboardAdjacent(intended[i], name[i])) {
      return {
        score: SCORES.keyboard,
        reason: `Looks like a keyboard typo of "${intended}": "${name[i]}" sits next to "${intended[i]}" on the keyboard.`,
      };
    }
    return {
      score: SCORES.substitution,
      reason: `Differs from "${intended}" by one letter ("${name[i]}" instead of "${intended[i]}").`,
    };
  }

  if (name.length < intended.length) {
    return {
      score: SCORES.missing,
      reason: `Looks like "${intended}" with a missing "${intended[i]}".`,
    };
  }

  const added = name[i];
  if (added === name[i - 1] || added === name[i + 1]) {
    return {
      score: SCORES.doubled,
      reason: `Looks like "${intended}" with "${added}" typed twice.`,
    };
  }
  return {
    score: SCORES.extra,
    reason: `Looks like "${intended}" with an extra "${added}".`,
  };
}

// Returns the look-alike finding for name against one popular name, or null.
function compare(name, intended) {
  if (name.replace(SEPARATORS, '') === intended.replace(SEPARATORS, '')) {
    return {
      intended,
      score: SCORES.separator,
      reason: `Same as "${intended}" apart from separators (-, _ or .).`,
    };
  }

  const maxDistance = maxDistanceFor(intended);
  if (maxDistance === 0 || Math.abs(name.length - intended.length) > maxDistance) return null;

  const distance = damerauLevenshtein(name, intended);
  if (distance === 0 || distance > maxDistance) return null;
  if (distance === 1) return { intended, ...describeSingleEdit(name, intended) };
  return {
    intended,
    score: SCORES.twoEdits,
    reason: describeTwoEdits(name, intended),
  };
}

// Mentions a swap of adjacent letters when one of the two edits is a swap.
function describeTwoEdits(name, intended) {
  for (let i = 0; i < name.length - 1; i++) {
    const unswapped = name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2);
    if (damerauLevenshtein(unswapped, intended) === 1) {
      return `Looks like "${intended}" with two adjacent letters swapped ("${unswapped.slice(i, i + 2)}" became "${name.slice(i, i + 2)}") and one other change.`;
    }
  }
  return `Only two small edits away from "${intended}".`;
}

function isCount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Extra risk from optional registry metadata.
function metadataSignals({ publisherAgeDays, weeklyDownloads } = {}) {
  const signals = [];
  if (isCount(publisherAgeDays)) {
    if (publisherAgeDays < 7) {
      signals.push({ score: 20, reason: `Publisher account is only ${plural(publisherAgeDays, 'day')} old.` });
    } else if (publisherAgeDays < 30) {
      signals.push({ score: 10, reason: `Publisher account is less than a month old (${plural(publisherAgeDays, 'day')}).` });
    }
  }
  if (isCount(weeklyDownloads)) {
    if (weeklyDownloads < 100) {
      signals.push({ score: 20, reason: `Only ${plural(weeklyDownloads, 'weekly download')}.` });
    } else if (weeklyDownloads < 1000) {
      signals.push({ score: 10, reason: `Low download count (${plural(weeklyDownloads, 'weekly download')}).` });
    }
  }
  return signals;
}

/**
 * Scores how likely a package name is a look-alike of a popular package.
 *
 * @param {string} name Package name to check.
 * @param {string[]|Set<string>} [popularList] Popular package names. Defaults to data/popular-npm.json.
 * @param {{publisherAgeDays?: number, weeklyDownloads?: number}} [metadata] Optional registry metadata.
 * @returns {{name: string, risk: number, likelyIntended: string|null, reasons: string[]}}
 */
function checkName(name, popularList = DEFAULT_POPULAR, metadata = {}) {
  const candidate = String(name).trim().toLowerCase();
  const popular = popularList instanceof Set ? popularList : new Set(popularList);

  if (popular.has(candidate)) {
    return {
      name,
      risk: 0,
      likelyIntended: candidate,
      reasons: [`Exact match for the popular package "${candidate}".`],
    };
  }

  // Keep the highest-scoring match; on a tie the earlier list entry wins.
  let best = null;
  for (const intended of popular) {
    const finding = compare(candidate, intended);
    if (finding && (!best || finding.score > best.score)) best = finding;
  }

  const signals = metadataSignals(metadata || {});
  const base = best ? best.score : 0;
  const risk = Math.min(100, signals.reduce((sum, s) => sum + s.score, base));

  return {
    name,
    risk,
    likelyIntended: best ? best.intended : null,
    reasons: [...(best ? [best.reason] : []), ...signals.map((s) => s.reason)],
  };
}

module.exports = { checkName };
