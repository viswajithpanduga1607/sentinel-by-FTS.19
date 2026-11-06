// Tests for the colour-mode report in src/report.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatFancy, formatTable } = require('../src/report');
const { createColors } = require('../src/colors');
const { scoreDependency } = require('../src/scorer');
const { checkName } = require('../src/nameRisk');

const strip = (text) => text.replace(/\x1b\[[\d;]+m/g, '');

const results = [
  scoreDependency(checkName('expres')),
  scoreDependency(checkName('crossenv')),
  scoreDependency(checkName('lodash')),
];

test('colour report shows every package, its verdict and the overall verdict', () => {
  const out = formatFancy(results, createColors(true, { truecolor: true }), { target: 'package.json', scanned: 0 });
  assert.ok(out.includes('\x1b['), 'colour report should contain colour codes');
  const plain = strip(out);
  assert.match(plain, /expres → express\s+BLOCK\s+█{7}░{3}\s+70/);
  assert.match(plain, /crossenv → cross-env\s+WARN\s+/);
  assert.match(plain, /lodash\s+OK\s+/);
  assert.match(plain, /1 BLOCK {2}· {2}1 WARN {2}· {2}1 OK/);
  assert.match(plain, /verdict: don't install yet\. 1 package looks sus\./);
});

test('colour report says all clear when nothing is flagged', () => {
  const out = strip(formatFancy([scoreDependency(checkName('lodash'))], createColors(true)));
  assert.match(out, /verdict: all clear\. ship it\./);
});

test('plain table never contains colour codes', () => {
  assert.ok(!formatTable(results).includes('\x1b'));
});
