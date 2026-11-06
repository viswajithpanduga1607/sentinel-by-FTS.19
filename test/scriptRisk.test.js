// Tests for src/scriptRisk.js. Run with: npm test
// Fixtures are only read as text by the scanner; nothing in them is run.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scanPackage } = require('../src/scriptRisk');

const FIXTURES = path.join(__dirname, '..', 'fixtures');

// Writes a throwaway package to a temp folder, scans it and cleans up.
function scanTempPackage(scripts, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-test-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'temp-pkg', scripts }, null, 2));
    for (const [name, source] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), source);
    }
    return scanPackage(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('evil fixture scores at least 90 with a credential-exfiltration finding', () => {
  const result = scanPackage(path.join(FIXTURES, 'evil-postinstall'));
  assert.equal(result.package, 'fake-evil-pkg');
  assert.ok(result.risk >= 90, `expected risk >= 90, got ${result.risk}`);
  const exfil = result.findings.find((f) => f.rule === 'credential-exfiltration');
  assert.ok(exfil, 'expected a credential-exfiltration finding');
  assert.equal(exfil.severity, 'critical');
  assert.equal(exfil.file, 'scripts/setup.js');
  assert.match(exfil.explanation, /credential exfiltration/i);
});

test('clean fixture scores 0', () => {
  const result = scanPackage(path.join(FIXTURES, 'clean-package'));
  assert.equal(result.package, 'fake-clean-pkg');
  assert.equal(result.risk, 0);
  assert.deepEqual(result.findings, []);
});

test('a script that fails to parse is flagged', () => {
  const result = scanTempPackage({ postinstall: 'node broken.js' }, { 'broken.js': 'function ( {' });
  const finding = result.findings.find((f) => f.rule === 'parse-error');
  assert.ok(finding, 'expected a parse-error finding');
  assert.equal(finding.file, 'broken.js');
  assert.ok(result.risk > 0);
});

test('reading only a proxy variable before a download is not exfiltration', () => {
  const result = scanTempPackage(
    { postinstall: 'node install.js' },
    { 'install.js': "const proxy = process.env.HTTPS_PROXY;\nrequire('https');\n" },
  );
  assert.ok(result.findings.some((f) => f.rule === 'network'));
  assert.ok(!result.findings.some((f) => f.rule === 'credential-exfiltration'));
  assert.ok(result.risk < 90);
});
