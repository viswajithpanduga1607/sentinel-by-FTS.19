// banner.js: compact "SENTINEL" ASCII banner with a tagline, shown at the start
// of the check command only when colours are on. The art is plain ASCII; in
// terminals with 24-bit colour it gets a neon green-cyan-purple gradient.

// Four-row letters, each row of a letter the same width.
const LETTERS = {
  S: [' ___ ', '/ __|', '\\__ \\', '|___/'],
  E: [' ___ ', '| __|', '| _| ', '|___|'],
  N: [' _  _ ', '| \\| |', '| .` |', '|_|\\_|'],
  T: [' _____ ', '|_   _|', '  | |  ', '  |_|  '],
  I: [' ___ ', '|_ _|', ' | | ', '|___|'],
  L: [' _    ', '| |   ', '| |__ ', '|____|'],
};

const TAGLINE = 'pre-install supply-chain gate';

// Gradient stops: matrix green, cyan, neon purple.
const STOPS = [[0, 255, 156], [0, 209, 255], [189, 0, 255]];

function renderWord(word) {
  return LETTERS[word[0]].map((_, row) => [...word].map((ch) => LETTERS[ch][row]).join('').trimEnd());
}

function gradientAt(t) {
  const scaled = t * (STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), STOPS.length - 2);
  const f = scaled - i;
  return STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * f));
}

function paint(c, line, width) {
  if (!c.truecolor) return c.green(line);
  return [...line].map((ch, x) => (ch === ' ' ? ch : c.rgb(...gradientAt(x / (width - 1)))(ch))).join('');
}

/**
 * Returns the banner text, or an empty string when colours are off, so plain
 * output never includes it.
 *
 * @param {object} c Colour functions from colors.createColors.
 * @param {{version?: string}} [options]
 */
function renderBanner(c, { version } = {}) {
  if (!c.enabled) return '';
  const art = renderWord('SENTINEL');
  const width = Math.max(...art.map((line) => line.length));
  const bar = c.rgb(0, 255, 156, 'green')('▌');
  const versionTag = version ? ` ${c.dim('·')} ${c.magenta(`v${version}`)}` : '';
  return [
    ...art.map((line) => c.bold(paint(c, line, width))),
    `${bar} ${c.cyan(TAGLINE)}${versionTag}`,
    `${bar} ${c.dim('static analysis only · nothing gets installed or run')}`,
    '',
  ].join('\n');
}

module.exports = { renderBanner };
