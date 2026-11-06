// Tests for the check command. Runs Sentinel's own CLI, which only reads the
// fixture as text; nothing inside the fixture is installed or run.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'src', 'cli.js');

function runCheck(...args) {
  return spawnSync(process.execPath, [CLI, 'check', ...args], { cwd: ROOT, encoding: 'utf8' });
}

test('check --no-color on the demo project prints no escape characters', () => {
  const result = runCheck('fixtures/demo-project', '--no-color');
  assert.equal(result.status, 1, 'demo project has BLOCK verdicts, so exit code should be 1');
  assert.ok(!result.stdout.includes('\x1b'), 'output should contain no ANSI escape characters');
  assert.ok(!result.stdout.includes('pre-install supply-chain gate'), 'banner should not be shown in plain mode');
  assert.match(result.stdout, /3 dependencies checked: 2 BLOCK, 0 WARN, 1 OK\./);
});

test('README example matches the real demo project output', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  const block = /```\n\$ node src\/cli\.js check fixtures\/demo-project\n([\s\S]*?)\n```/.exec(readme);
  assert.ok(block, 'README should contain the demo-project example');
  const result = runCheck('fixtures/demo-project', '--no-color');
  assert.equal(result.stdout.replace(/\r\n/g, '\n').trimEnd(), block[1].trimEnd());
});
