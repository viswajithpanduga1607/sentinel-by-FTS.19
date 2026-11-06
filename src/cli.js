#!/usr/bin/env node
// cli.js: command-line entry point. Parses arguments with commander and hands
// work to the analysis modules (nameRisk, scriptRisk), the scorer and the report.

const fs = require('node:fs');
const path = require('node:path');
const { Command } = require('commander');
const pkg = require('../package.json');
const { checkName } = require('./nameRisk');
const { scanPackage } = require('./scriptRisk');
const { scoreDependency } = require('./scorer');
const { formatTable, formatSummary } = require('./report');
const { colorEnabled, createColors } = require('./colors');
const { renderBanner } = require('./banner');

// Accepts a project folder or a path to a package.json file.
function resolveManifest(target) {
  const resolved = path.resolve(target);
  const isDir = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
  return isDir ? path.join(resolved, 'package.json') : resolved;
}

// Reads the manifest as plain JSON. Nothing is installed or executed.
function readDependencies(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const deps = new Map();
  for (const field of ['dependencies', 'devDependencies']) {
    const entries = manifest[field];
    if (entries && typeof entries === 'object') {
      for (const [name, spec] of Object.entries(entries)) {
        if (!deps.has(name)) deps.set(name, spec);
      }
    }
  }
  return [...deps].map(([name, spec]) => ({ name, spec }));
}

// Local folder for a dependency: a "file:" path, or an existing
// node_modules/<name>. Returns null when there is nothing local to scan.
function localPackageDir(projectDir, name, spec) {
  if (typeof spec === 'string' && spec.startsWith('file:')) {
    return path.resolve(projectDir, spec.slice('file:'.length));
  }
  const installed = path.join(projectDir, 'node_modules', ...name.split('/'));
  return fs.existsSync(path.join(installed, 'package.json')) ? installed : null;
}

function scanLocal(dir) {
  if (!dir) return null;
  try {
    return scanPackage(dir);
  } catch (err) {
    return { risk: 0, findings: [], error: err.message };
  }
}

function check(target, options) {
  const c = createColors(options.color !== false && colorEnabled());
  if (c.enabled) console.log(renderBanner(c));
  const manifestPath = resolveManifest(target);
  let deps;
  try {
    deps = readDependencies(manifestPath);
  } catch (err) {
    console.error(`Could not read ${manifestPath}: ${err.message}`);
    process.exitCode = 2;
    return;
  }

  if (deps.length === 0) {
    console.log(`No dependencies found in ${manifestPath}.`);
    return;
  }

  const projectDir = path.dirname(manifestPath);
  const results = deps.map(({ name, spec }) =>
    scoreDependency(checkName(name), scanLocal(localPackageDir(projectDir, name, spec))),
  );
  console.log(formatTable(results, c));
  console.log('');
  console.log(formatSummary(results, c));
  process.exitCode = results.some((r) => r.verdict === 'BLOCK') ? 1 : 0;
}

const program = new Command();

program
  .name('sentinel')
  .description(pkg.description)
  .version(pkg.version);

program
  .command('check')
  .description('check dependencies for look-alike names and risky install scripts')
  .argument('<path>', 'project folder or path to a package.json file')
  .option('--no-color', 'disable coloured output (also off when NO_COLOR is set or output is not a terminal)')
  .action(check);

program.parse(process.argv);
