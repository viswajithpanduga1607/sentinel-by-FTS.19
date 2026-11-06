#!/usr/bin/env node
// cli.js: command-line entry point. Parses arguments with commander and hands
// work to the analysis modules (nameRisk, scriptRisk), the scorer and the report.

const { Command } = require('commander');
const pkg = require('../package.json');

const program = new Command();

program
  .name('sentinel')
  .description(pkg.description)
  .version(pkg.version);

program.parse(process.argv);
