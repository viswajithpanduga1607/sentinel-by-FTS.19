// colors.js: minimal ANSI colour helper (no library). Colours are off unless
// stdout is a terminal, and are always off when NO_COLOR is set or the user
// passes --no-color.

const CODES = {
  green: [32, 39],
  red: [31, 39],
  yellow: [33, 39],
  cyan: [36, 39],
  magenta: [35, 39],
  white: [97, 39],
  black: [30, 39],
  bgRed: [41, 49],
  bgYellow: [43, 49],
  bgGreen: [42, 49],
  dim: [2, 22],
  bold: [1, 22],
};

// 24-bit colour is used for gradients only where the terminal is known to
// support it; everything else falls back to the basic colours above.
function supportsTruecolor(env = process.env) {
  return /^(truecolor|24bit)$/i.test(env.COLORTERM || '') ||
    Boolean(env.WT_SESSION) ||
    ['vscode', 'iTerm.app', 'WezTerm'].includes(env.TERM_PROGRAM);
}

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

// Returns { enabled, truecolor, green, red, ..., rgb }. When disabled every
// function returns its input unchanged, so plain output is byte-for-byte the same.
function createColors(enabled = colorEnabled(), { truecolor = supportsTruecolor() } = {}) {
  const colors = { enabled, truecolor: enabled && truecolor };
  for (const [name, [open, close]] of Object.entries(CODES)) {
    colors[name] = enabled ? (text) => `\x1b[${open}m${text}\x1b[${close}m` : (text) => String(text);
  }
  // rgb(r, g, b, fallback) colours text with a 24-bit colour, or with the named
  // basic colour when the terminal lacks 24-bit support.
  colors.rgb = (r, g, b, fallback = 'green') =>
    colors.truecolor ? (text) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m` : colors[fallback];
  return colors;
}

module.exports = { colorEnabled, createColors, supportsTruecolor };
