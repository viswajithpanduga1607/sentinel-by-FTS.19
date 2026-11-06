# FAKE TEST FIXTURE: never install, never run

This folder imitates a malicious npm package so Sentinel's static install-script scanner has something to detect.

- **Never run `npm install` here, never run `scripts/setup.js`, and never `require` it.**
- `scripts/setup.js` pretends to read `process.env` and list `~/.ssh`, then send the data with `https.request` to the fake URL `http://localhost:9999/collect`.
- As an extra safeguard the script exits on its first line if executed, so the fake malicious code below it never runs.
- Sentinel only reads these files as text. Contains no real secrets and no real malware.
