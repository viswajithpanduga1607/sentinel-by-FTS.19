# CLAUDE.md

Project rules for Claude Code working on **Sentinel** (team FTS.19), a CLI that checks npm dependencies for supply-chain risk *before* install.

## Safety

- Static analysis only. Never run, install or execute any script from test fixtures.
- Never run `npm install` (or any package manager command) on fixtures.
- Fixtures are fake and clearly marked; they must contain no real secrets and no real malware.
- Fixtures live in the top-level `fixtures/` folder, never under `test/`, so `node --test` cannot pick them up and run them.
- Never give a fixture file or folder a name the test runner matches: no `*.test.js`, `*-test.js`, `*_test.js`, `test-*.js`, `test.js` (or the `.cjs`/`.mjs` equivalents), and no folder named `test`.

## Stack

- Node.js, CommonJS (`require` / `module.exports`).
- Runtime dependencies are limited to `commander` and `acorn`. Do not add others.

## Workflow

- After every working change:
  1. Update `README.md` if behaviour changed.
  2. Make one small commit with a Conventional Commits message (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Never commit `node_modules`.
