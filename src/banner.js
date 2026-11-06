// banner.js: compact "SENTINEL" ASCII banner with a tagline, shown at the start
// of the check command only when colours are on. Plain ASCII so it renders in
// any terminal.

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

function renderWord(word) {
  return LETTERS[word[0]].map((_, row) => [...word].map((ch) => LETTERS[ch][row]).join('').trimEnd());
}

/**
 * Returns the banner text, or an empty string when colours are off, so plain
 * output never includes it.
 *
 * @param {object} c Colour functions from colors.createColors.
 */
function renderBanner(c) {
  if (!c.enabled) return '';
  const art = renderWord('SENTINEL').map((line) => c.green(line));
  return [...art, c.cyan(TAGLINE), ''].join('\n');
}

module.exports = { renderBanner };
