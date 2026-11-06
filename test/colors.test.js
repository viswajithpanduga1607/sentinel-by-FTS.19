// Tests for src/colors.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { colorEnabled, createColors } = require('../src/colors');

const TERMINAL = { isTTY: true };

test('colour is on for a terminal when nothing disables it', () => {
  assert.equal(colorEnabled({ stream: TERMINAL, env: {}, argv: [] }), true);
  assert.equal(createColors(true).red('x'), '\x1b[31mx\x1b[39m');
});

test('colour helper turns itself off when NO_COLOR is set', () => {
  const enabled = colorEnabled({ stream: TERMINAL, env: { NO_COLOR: '1' }, argv: [] });
  assert.equal(enabled, false);
  const c = createColors(enabled);
  assert.equal(c.red('x'), 'x');
  assert.equal(c.bold(c.green('ok')), 'ok');
});

test('colour is off with --no-color or when output is not a terminal', () => {
  assert.equal(colorEnabled({ stream: TERMINAL, env: {}, argv: ['node', 'cli.js', 'check', '.', '--no-color'] }), false);
  assert.equal(colorEnabled({ stream: { isTTY: false }, env: {}, argv: [] }), false);
});
