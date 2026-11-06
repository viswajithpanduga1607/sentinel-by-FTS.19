# CLAUDE.md

Project rules for Claude Code working on **Sentinel** (team FTS.19), a CLI that checks npm dependencies for supply-chain risk *before* install.

## Safety

- Static analysis only. Never run, install or execute any script from test fixtures.
- Never run `npm install` (or any package manager command) on fixtures.
- Fixtures are fake and clearly marked; they must contain no real secrets and no real malware.

## Stack

- Node.js, CommonJS (`require` / `module.exports`).
- Runtime dependencies are limited to `commander` and `acorn`. Do not add others.

## Workflow

- After every working change:
  1. Update `README.md` if behaviour changed.
  2. Make one small commit with a Conventional Commits message (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Never commit `node_modules`.
