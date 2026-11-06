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

## Data

`data/popular-npm.json` is the list of popular package names that look-alike names are compared against. It is a hand-curated seed list of widely used npm packages, compiled with Claude Code from general knowledge rather than pulled from registry download statistics, and is meant to be expanded.

## Name-risk scoring

`checkName(name, popularList, metadata)` in `src/nameRisk.js` scores a package name from 0 to 100 and reports the popular package it most likely imitates, with a plain-language reason. An exact match with a popular package scores 0. Otherwise the closest match decides the base score:

| Finding | Example | Score |
| --- | --- | --- |
| Two adjacent letters swapped | `axois` → `axios` | 75 |
| Keyboard-adjacent typo | `reacr` → `react` | 70 |
| Missing letter | `expres` → `express` | 70 |
| Doubled letter | `lodassh` → `lodash` | 70 |
| Separator change (`-`, `_`, `.` or none) | `crossenv` → `cross-env` | 65 |
| Other single-letter change or extra letter | `chaik` → `chalk` | 55 |
| Two edits away (Damerau-Levenshtein) | `reqeusts` → `request` | 40 |

To limit false positives, popular names of 3–5 characters only match at one edit, and names of 1–2 characters (such as `ms` or `qs`) only get the separator rule.

Optional metadata raises the score, capped at 100: a publisher account under 7 days old adds 20 (under 30 days adds 10), and fewer than 100 weekly downloads adds 20 (fewer than 1,000 adds 10).

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

Sentinel is built by team **FTS.19**:

- Charan Teja
- Dhanesh Guptha
- Vamshi Krishna
- Viswajith Reddy

All four members took part in planning, building and testing. The build was done on one shared laptop, so commit authorship does not reflect who contributed what.

## Use of AI coding assistants

This project uses AI coding assistants (Claude Code) during development. Project rules for the assistant are in [CLAUDE.md](CLAUDE.md).
