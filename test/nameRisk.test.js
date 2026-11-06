// Tests for src/nameRisk.js. Run with: npm test
// The fixture is read as plain JSON only; nothing in it is installed or run.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkName } = require('../src/nameRisk');

test('exact match with a popular package scores 0', () => {
  const result = checkName('express');
  assert.equal(result.risk, 0);
  assert.equal(result.likelyIntended, 'express');
  assert.match(result.reasons[0], /Exact match/);
});

test('swapped letters are flagged', () => {
  const result = checkName('axois');
  assert.equal(result.likelyIntended, 'axios');
  assert.ok(result.risk >= 70, `expected risk >= 70, got ${result.risk}`);
  assert.match(result.reasons[0], /swapped/);
});

test('a missing letter is flagged', () => {
  const result = checkName('expres');
  assert.equal(result.likelyIntended, 'express');
  assert.ok(result.risk >= 70, `expected risk >= 70, got ${result.risk}`);
  assert.match(result.reasons[0], /missing "s"/);
});

test('a keyboard-adjacent typo is flagged', () => {
  const result = checkName('reacr');
  assert.equal(result.likelyIntended, 'react');
  assert.ok(result.risk >= 70, `expected risk >= 70, got ${result.risk}`);
  assert.match(result.reasons[0], /keyboard/);
});

test('a safe unrelated name scores 0', () => {
  const result = checkName('sentinel');
  assert.deepEqual(result, { name: 'sentinel', risk: 0, likelyIntended: null, reasons: [] });
});

test('a new publisher and tiny download count raise the score', () => {
  const plain = checkName('axois');
  const withMetadata = checkName('axois', undefined, { publisherAgeDays: 2, weeklyDownloads: 12 });
  assert.ok(withMetadata.risk > plain.risk);
  assert.ok(withMetadata.risk <= 100);
  assert.equal(withMetadata.reasons.length, 3);
});

test('every dependency in the look-alike fixture is flagged', () => {
  const manifest = path.join(__dirname, '..', 'fixtures', 'lookalike-project', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.ok(names.length > 0);
  for (const name of names) {
    const result = checkName(name);
    assert.ok(result.risk > 0, `${name} should be flagged`);
    assert.ok(result.likelyIntended, `${name} should have a likely intended package`);
  }
});
