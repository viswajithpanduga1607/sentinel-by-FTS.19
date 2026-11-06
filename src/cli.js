#!/usr/bin/env node
// cli.js: command-line entry point. Parses arguments with commander and hands
// work to the analysis modules (nameRisk, scriptRisk), the scorer and the report.

const fs = require('node:fs');
const path = require('node:path');
const { Command } = require('commander');
const pkg = require('../package.json');
const { checkName } = require('./nameRisk');
const { formatTable, formatSummary } = require('./report');

// Any dependency at or above this risk makes `check` exit with code 1.
const HIGH_RISK = 70;

// Accepts a project folder or a path to a package.json file.
function resolveManifest(target) {
  const resolved = path.resolve(target);
  const isDir = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
  return isDir ? path.join(resolved, 'package.json') : resolved;
}

// Reads the manifest as plain JSON. Nothing is installed or executed.
function readDependencyNames(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const names = new Set();
  for (const field of ['dependencies', 'devDependencies']) {
    const deps = manifest[field];
    if (deps && typeof deps === 'object') {
      Object.keys(deps).forEach((name) => names.add(name));
    }
  }
  return [...names];
}

function check(target) {
  const manifestPath = resolveManifest(target);
  let names;
  try {
    names = readDependencyNames(manifestPath);
  } catch (err) {
    console.error(`Could not read ${manifestPath}: ${err.message}`);
    process.exitCode = 2;
    return;
  }

  if (names.length === 0) {
    console.log(`No dependencies found in ${manifestPath}.`);
    return;
  }

  const results = names.map((name) => checkName(name));
  console.log(formatTable(results));
  console.log('');
  console.log(formatSummary(results, HIGH_RISK));
  process.exitCode = results.some((r) => r.risk >= HIGH_RISK) ? 1 : 0;
}

const program = new Command();

program
  .name('sentinel')
  .description(pkg.description)
  .version(pkg.version);

program
  .command('check')
  .description('check dependencies in a package.json for look-alike package names')
  .argument('<path>', 'project folder or path to a package.json file')
  .action(check);

program.parse(process.argv);
