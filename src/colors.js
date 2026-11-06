// colors.js: minimal ANSI colour helper (no library). Colours are off unless
// stdout is a terminal, and are always off when NO_COLOR is set or the user
// passes --no-color.

const CODES = {
  green: [32, 39],
  red: [31, 39],
  yellow: [33, 39],
  cyan: [36, 39],
  magenta: [35, 39],
  dim: [2, 22],
  bold: [1, 22],
};

/**
 * Decides whether to use colour. Follows https://no-color.org: NO_COLOR
 * disables colour when it is set to a non-empty value.
 *
 * @param {{stream?: {isTTY?: boolean}, env?: object, argv?: string[]}} [options]
 */
function colorEnabled({ stream = process.stdout, env = process.env, argv = process.argv } = {}) {
  if (argv.includes('--no-color')) return false;
  if (typeof env.NO_COLOR === 'string' && env.NO_COLOR !== '') return false;
  return Boolean(stream && stream.isTTY);
}

// Returns { enabled, green, red, ... }. When disabled every function returns
// its input unchanged, so plain output is byte-for-byte the same.
function createColors(enabled = colorEnabled()) {
  const colors = { enabled };
  for (const [name, [open, close]] of Object.entries(CODES)) {
    colors[name] = enabled ? (text) => `\x1b[${open}m${text}\x1b[${close}m` : (text) => String(text);
  }
  return colors;
}

module.exports = { colorEnabled, createColors };
