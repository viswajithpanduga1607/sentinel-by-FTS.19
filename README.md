# Sentinel

Pre-install supply-chain gate for npm packages. Built at Devf8rge Hacktoberfest Hack Day by team FTS.19.

## Overview

Sentinel is a command-line tool that checks a project's npm dependencies for supply-chain risk *before* you run `npm install`. It uses static analysis only: it reads package metadata and source, and never installs or executes anything.

It targets two threats:

- **Look-alike package names (typosquatting).** Packages whose names imitate popular ones, such as `expres` or `lodahs`, to catch a typo or a careless copy-paste.
- **Malicious install scripts.** `preinstall`, `install` and `postinstall` scripts that run automatically during install and can download payloads, read secrets or open network connections.

> **Status:** early skeleton. The CLI runs and shows help, but no detection logic is implemented yet.

## Planned architecture

```
src/
  cli.js         Entry point: parses arguments (commander) and wires the modules together
  nameRisk.js    Flags look-alike names by comparing against popular packages
  scriptRisk.js  Parses install scripts with acorn and flags risky patterns, without running them
  scorer.js      Combines findings into a risk score and verdict per dependency
  report.js      Formats results for the terminal
```

Flow: `cli` → `nameRisk` + `scriptRisk` → `scorer` → `report`.

Runtime dependencies are limited to [commander](https://www.npmjs.com/package/commander) and [acorn](https://www.npmjs.com/package/acorn).

## Requirements

- Node.js 20 or newer

## Setup

1. Clone the repository:
   ```sh
   git clone https://github.com/charanteja7989967-sudo/fts19-sentinel.git
   cd fts19-sentinel
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Check that the CLI runs:
   ```sh
   node src/cli.js --help
   ```

## Team and contributions

Sentinel is built by team **FTS.19**. The build was done on one shared laptop, so commit authorship does not reflect who contributed what; all team members worked on the project together.

## Use of AI coding assistants

This project uses AI coding assistants (Claude Code) during development. Project rules for the assistant are in [CLAUDE.md](CLAUDE.md).
