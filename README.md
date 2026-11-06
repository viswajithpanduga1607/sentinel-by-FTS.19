# Sentinel

Pre-install supply-chain gate for npm packages. Built at Devf8rge Hacktoberfest Hack Day by team FTS.19.

## Overview

Sentinel is a command-line tool that checks a project's npm dependencies for supply-chain risk *before* you run `npm install`. It uses static analysis only: it reads package metadata and source, and never installs or executes anything.

It targets two threats:

- **Look-alike package names (typosquatting).** Packages whose names imitate popular ones, such as `expres` or `lodahs`, to catch a typo or a careless copy-paste.
- **Malicious install scripts.** `preinstall`, `install` and `postinstall` scripts that run automatically during install and can download payloads, read secrets or open network connections.

> **Status:** look-alike name detection works via `sentinel check`. Install-script analysis is not implemented yet.

## Usage

```sh
node src/cli.js check <path>
```

`<path>` is a project folder or a path to a `package.json` file. Sentinel reads `dependencies` and `devDependencies` as plain JSON (nothing is installed or run), scores each name for look-alike risk, and prints a table sorted by risk.

Example, using the fake look-alike fixture:

```
$ node src/cli.js check fixtures/lookalike-project
Package   Risk  Likely intended  Reason
--------  ----  ---------------  ------
axois     75    axios            Looks like "axios" with two adjacent letters swapped ("io" became "oi").
eslnit    75    eslint           Looks like "eslint" with two adjacent letters swapped ("in" became "ni").
jset      75    jest             Looks like "jest" with two adjacent letters swapped ("es" became "se").
lodahs    75    lodash           Looks like "lodash" with two adjacent letters swapped ("sh" became "hs").
expres    70    express          Looks like "express" with a missing "s".
crossenv  65    cross-env        Same as "cross-env" apart from separators (-, _ or .).

6 dependencies checked, 5 at or above risk 70.
```

Exit codes, so `check` can gate a CI job or a pre-install hook:

| Code | Meaning |
| --- | --- |
| 0 | No dependency scored 70 or above |
| 1 | At least one dependency scored 70 or above |
| 2 | The `package.json` could not be read or parsed |

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

## Install-script scanning

`scanPackage(packageDir)` in `src/scriptRisk.js` reads a package's `preinstall`, `install` and `postinstall` scripts and returns `{ package, risk, findings }`, where each finding has a `rule`, `severity`, `file`, `line` and a plain-language `explanation`. Everything is static: script strings are pattern-matched, and files run with `node <file>` are read as text and parsed with acorn. Nothing is executed, required or installed.

| Rule | Looks for | Severity |
| --- | --- | --- |
| `credential-exfiltration` | Sensitive environment access (medium or high `env-access`) **and** a network call in the same package | critical |
| `curl-pipe-shell` | `curl` or `wget` piped into a shell | high |
| `powershell-download` | PowerShell download cradles (`DownloadString`, `Invoke-WebRequest`, `IEX`, `-EncodedCommand`) | high |
| `network` | `http`, `https`, `net`, `dns`, `tls`, `request`, `axios` and similar modules, `fetch()`, `XMLHttpRequest`, `WebSocket` | high |
| `sensitive-file` | Paths to `~/.ssh`, `.npmrc`, `~/.aws`, `.netrc`, `.git-credentials` or credential files | high |
| `eval` | `eval()`, `Function()` / `new Function()` (high); loading `vm` (medium) | high / medium |
| `env-access` | Reading the whole `process.env` (high); variables whose names look like secrets, such as `NPM_TOKEN`, `*_SECRET`, `AWS_*`, `GITHUB_*`, or computed names (medium); any other single variable (low) | high / medium / low |
| `child-process` | Loading `child_process` (exec/spawn) | medium |
| `obfuscation` | Long base64 or hex strings, `\x` escape runs, `String.fromCharCode` chains, runtime base64 decoding | medium |
| `base64-decode` | `base64 -d` in a script string | medium |
| `parse-error` | A script file acorn cannot parse | medium |
| `outside-package` / `missing-script-file` | A script runs a file outside the package or one that is missing | medium / low |

Reading an ordinary variable such as `HTTPS_PROXY` before a download does not trigger `credential-exfiltration`, so legitimate packages that fetch prebuilt binaries during install are not treated as stealing credentials.

The package risk is the score of its most severe finding (critical 90, high 60, medium 35, low 10), plus 5 for each additional distinct rule, capped at 100. A package with no findings scores 0.

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

## Running tests

```sh
npm test
```

Tests use Node's built-in test runner (`node --test`), so no extra dependencies are needed.

Fixtures live in the top-level `fixtures/` folder. They are fake projects that Sentinel only reads as plain files; never install or run anything inside them. They are kept outside `test/` because `node --test` runs every `.js` file it finds under a `test/` folder, and fixture files are never given names the test runner picks up (such as `*.test.js`, `*-test.js` or `test-*.js`).

## Team and contributions

Sentinel is built by team **FTS.19**:

- Charan Teja
- Dhanesh Guptha
- Vamshi Krishna
- Viswajith Reddy

All four members took part in planning, building and testing. The build was done on one shared laptop, so commit authorship does not reflect who contributed what.

## Use of AI coding assistants

This project uses AI coding assistants (Claude Code) during development. Project rules for the assistant are in [CLAUDE.md](CLAUDE.md).
