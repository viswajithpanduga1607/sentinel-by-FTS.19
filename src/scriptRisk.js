// scriptRisk.js: statically inspects a package's install lifecycle scripts
// (preinstall, install, postinstall) for risky patterns. Script strings are
// matched against shell patterns, and files run with "node <file>" are read as
// text and parsed with acorn. Nothing is ever executed, required or installed.

const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const HOOKS = ['preinstall', 'install', 'postinstall'];

// Risk points for the most severe finding in a package.
const SEVERITY_POINTS = { critical: 90, high: 60, medium: 35, low: 10 };

const SHELL_RULES = [
  {
    rule: 'curl-pipe-shell',
    severity: 'high',
    pattern: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|dash|ksh)\b/i,
    explanation: 'Downloads a script with curl or wget and pipes it straight into a shell, so whatever the server sends is run.',
  },
  {
    rule: 'powershell-download',
    severity: 'high',
    test: (script) =>
      /\b(powershell|pwsh)(\.exe)?\b/i.test(script) &&
      /(DownloadString|DownloadFile|Net\.WebClient|Invoke-WebRequest|\biwr\b|Invoke-RestMethod|\birm\b|Invoke-Expression|\biex\b|-enc(odedcommand)?\b)/i.test(script),
    explanation: 'Uses PowerShell to download or run remote or encoded code (a "download cradle").',
  },
  {
    rule: 'base64-decode',
    severity: 'medium',
    pattern: /\bbase64\s+(-d|-D|--decode)\b/,
    explanation: 'Decodes base64 in the shell, a common way to hide the real command.',
  },
];

const NETWORK_MODULES = new Set([
  'http', 'https', 'http2', 'net', 'tls', 'dns', 'dgram',
  'request', 'axios', 'node-fetch', 'got', 'superagent', 'undici',
]);
const NETWORK_GLOBALS = new Set(['fetch']);
const NETWORK_CONSTRUCTORS = new Set(['XMLHttpRequest', 'WebSocket']);

const SENSITIVE_PATHS = [
  { pattern: /(^|[\\/~])\.ssh([\\/]|$)|\bid_(rsa|dsa|ecdsa|ed25519)\b/, label: 'SSH keys (~/.ssh)' },
  { pattern: /\.npmrc\b/, label: 'npm tokens (.npmrc)' },
  { pattern: /(^|[\\/~])\.aws([\\/]|$)/, label: 'AWS credentials (~/.aws)' },
  { pattern: /\.netrc\b|\.git-credentials\b|\.pypirc\b|\.docker[\\/]config\.json/, label: 'stored login credentials' },
  { pattern: /(^|[\\/])credentials?(\.json)?$/i, label: 'a credentials file' },
];

// Environment variable names that usually hold secrets. Proxy and npm_config_*
// settings deliberately do not match, so binary downloaders are not flagged.
const SECRET_VAR = /TOKEN|SECRET|PASSW|PASS$|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIAL|AUTH|SESSION|COOKIE|^(AWS|GITHUB|GH|GITLAB|AZURE|GCP|GOOGLE|STRIPE|SLACK|DOCKER|HEROKU|VERCEL|NETLIFY)_/i;

const LONG_BASE64 = /^[A-Za-z0-9+/]{100,}={0,2}$/;
const LONG_HEX = /^[0-9a-fA-F]{100,}$/;
const HEX_ESCAPES = /(\\x[0-9a-fA-F]{2}){20,}/;

function normaliseModule(name) {
  return name.startsWith('node:') ? name.slice(5) : name;
}

function isStringLiteral(node) {
  return node && node.type === 'Literal' && typeof node.value === 'string';
}

function isIdentifier(node, name) {
  return node && node.type === 'Identifier' && node.name === name;
}

function propertyName(member) {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (isStringLiteral(member.property)) return member.property.value;
  return null;
}

function isProcessEnv(node) {
  return node.type === 'MemberExpression' && isIdentifier(node.object, 'process') && propertyName(node) === 'env';
}

// Module name for require('x'), import('x') or import ... from 'x'.
function importedModule(node) {
  if (node.type === 'CallExpression' && isIdentifier(node.callee, 'require') && isStringLiteral(node.arguments[0])) {
    return node.arguments[0].value;
  }
  if ((node.type === 'ImportDeclaration' || node.type === 'ImportExpression') && isStringLiteral(node.source)) {
    return node.source.value;
  }
  return null;
}

// Iterative AST walk (deeply nested obfuscated code can overflow recursion).
function walk(root, visit) {
  const stack = [[root, null]];
  while (stack.length) {
    const [node, parent] = stack.pop();
    visit(node, parent);
    for (const key of Object.keys(node)) {
      if (key === 'loc') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) if (c && typeof c.type === 'string') stack.push([c, node]);
      } else if (child && typeof child.type === 'string') {
        stack.push([child, node]);
      }
    }
  }
}

function parse(source) {
  const options = { ecmaVersion: 'latest', allowHashBang: true, locations: true };
  try {
    return acorn.parse(source, { ...options, sourceType: 'script', allowReturnOutsideFunction: true });
  } catch (scriptError) {
    try {
      return acorn.parse(source, { ...options, sourceType: 'module', allowAwaitOutsideFunction: true });
    } catch {
      throw scriptError;
    }
  }
}

// Scans one JavaScript file's AST and returns its findings.
function scanSource(source, file) {
  const findings = [];
  const add = (rule, severity, node, explanation) =>
    findings.push({ rule, severity, file, line: node.loc ? node.loc.start.line : null, explanation });

  let ast;
  try {
    ast = parse(source);
  } catch (err) {
    findings.push({
      rule: 'parse-error',
      severity: 'medium',
      file,
      line: err.loc ? err.loc.line : null,
      explanation: `Could not be parsed as JavaScript (${err.message}). Malformed or heavily obfuscated install code is suspicious and cannot be checked.`,
    });
    return findings;
  }

  let fromCharCodeCalls = 0;
  let firstFromCharCode = null;

  walk(ast, (node, parent) => {
    const mod = importedModule(node);
    if (mod) {
      const name = normaliseModule(mod);
      if (NETWORK_MODULES.has(name)) add('network', 'high', node, `Loads the network module "${name}", so it can send or receive data over the internet.`);
      if (name === 'child_process') add('child-process', 'medium', node, 'Loads child_process, so it can run other programs and shell commands (exec/spawn).');
      if (name === 'vm') add('eval', 'medium', node, 'Loads the vm module, which can run code built from strings.');
    }

    if (node.type === 'CallExpression' && NETWORK_GLOBALS.has(node.callee.name)) {
      add('network', 'high', node, `Calls ${node.callee.name}(), which makes a network request.`);
    }
    if (node.type === 'NewExpression' && node.callee.type === 'Identifier' && NETWORK_CONSTRUCTORS.has(node.callee.name)) {
      add('network', 'high', node, `Creates a ${node.callee.name}, which makes a network connection.`);
    }

    if (isProcessEnv(node)) {
      const readsOneVar = parent && parent.type === 'MemberExpression' && parent.object === node;
      const destructures = parent && parent.type === 'VariableDeclarator' && parent.init === node && parent.id.type === 'ObjectPattern';
      if (readsOneVar) {
        const name = propertyName(parent);
        if (name === null) {
          add('env-access', 'medium', node, 'Reads environment variables by computed name, so it may be looping over all of them.');
        } else if (SECRET_VAR.test(name)) {
          add('env-access', 'medium', node, `Reads the environment variable "${name}", which looks like it holds a secret.`);
        } else {
          add('env-access', 'low', node, `Reads the environment variable "${name}".`);
        }
      } else if (destructures) {
        const names = parent.id.properties.map((p) => (p.type === 'Property' ? propertyName({ computed: p.computed, property: p.key }) : null));
        const secrets = names.filter((n) => n && SECRET_VAR.test(n));
        if (secrets.length || names.includes(null)) {
          add('env-access', 'medium', node, `Reads environment variables that look like secrets (${secrets.join(', ') || 'rest pattern or computed names'}).`);
        } else {
          add('env-access', 'low', node, `Reads the environment variables ${names.join(', ')}.`);
        }
      } else {
        add('env-access', 'high', node, 'Reads the whole process.env object, which often holds tokens, passwords and API keys.');
      }
    }

    const text = isStringLiteral(node) ? node.value : node.type === 'TemplateElement' ? node.value.cooked || '' : null;
    if (text !== null) {
      const hit = SENSITIVE_PATHS.find((s) => s.pattern.test(text));
      if (hit) add('sensitive-file', 'high', node, `Refers to ${hit.label} ("${text}").`);
      if (LONG_BASE64.test(text) || LONG_HEX.test(text)) {
        add('obfuscation', 'medium', node, `Contains a long encoded string (${text.length} characters) that may hide code or data.`);
      } else if (node.raw && HEX_ESCAPES.test(node.raw)) {
        add('obfuscation', 'medium', node, 'Contains a long run of \\x hex escapes that may hide code or data.');
      }
    }

    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (isIdentifier(callee, 'eval')) add('eval', 'high', node, 'Calls eval(), which runs code built from a string.');
      if (isIdentifier(callee, 'Function')) add('eval', 'high', node, 'Calls Function(), which runs code built from a string.');
      if (callee.type === 'MemberExpression' && isIdentifier(callee.object, 'String') && propertyName(callee) === 'fromCharCode') {
        fromCharCodeCalls++;
        if (!firstFromCharCode) firstFromCharCode = node;
        if (node.arguments.length >= 8) add('obfuscation', 'medium', node, `Builds a string from ${node.arguments.length} character codes with String.fromCharCode, a common way to hide text.`);
      }
      const decodesBase64 =
        (callee.type === 'MemberExpression' && isIdentifier(callee.object, 'Buffer') && propertyName(callee) === 'from' &&
          isStringLiteral(node.arguments[1]) && node.arguments[1].value === 'base64') ||
        isIdentifier(callee, 'atob');
      if (decodesBase64) add('obfuscation', 'medium', node, 'Decodes base64 text at runtime, which can hide the real code or URL.');
    }
    if (node.type === 'NewExpression' && isIdentifier(node.callee, 'Function')) {
      add('eval', 'high', node, 'Uses new Function(), which runs code built from a string.');
    }
  });

  if (fromCharCodeCalls >= 5 && !findings.some((f) => f.rule === 'obfuscation' && /fromCharCode/.test(f.explanation))) {
    add('obfuscation', 'medium', firstFromCharCode, `Calls String.fromCharCode ${fromCharCodeCalls} times, a common way to hide text.`);
  }

  return findings;
}

// Files run by "node <file>" in a script string (flags such as -r are skipped).
function nodeScriptFiles(script) {
  const files = [];
  const re = /(?:^|[;&|]\s*|\s)node(?:\.exe)?\s+((?:-{1,2}[\w-]+(?:=\S+)?\s+)*)(["']?)([^\s"'&|;]+)\2/g;
  let match;
  while ((match = re.exec(script)) !== null) {
    const flags = match[1];
    if (/(^|\s)(-e|--eval|-p|--print)\s/.test(flags)) continue;
    files.push(match[3]);
  }
  return files;
}

function lineOf(rawText, needle) {
  const index = rawText.split(/\r?\n/).findIndex((l) => l.includes(needle));
  return index === -1 ? null : index + 1;
}

function scoreFindings(findings) {
  if (findings.length === 0) return 0;
  const worst = Math.max(...findings.map((f) => SEVERITY_POINTS[f.severity]));
  const distinctRules = new Set(findings.map((f) => f.rule)).size;
  return Math.min(100, worst + 5 * (distinctRules - 1));
}

/**
 * Statically scans a package folder's install scripts.
 *
 * @param {string} packageDir Folder containing the package's package.json.
 * @returns {{package: string, risk: number, findings: {rule: string, severity: string, file: string, line: number|null, explanation: string}[]}}
 */
function scanPackage(packageDir) {
  const root = path.resolve(packageDir);
  const manifestRaw = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const scripts = manifest.scripts && typeof manifest.scripts === 'object' ? manifest.scripts : {};
  const findings = [];
  const scanned = new Set();

  for (const hook of HOOKS) {
    const script = scripts[hook];
    if (typeof script !== 'string') continue;
    const hookLine = lineOf(manifestRaw, `"${hook}"`);

    for (const rule of SHELL_RULES) {
      const matched = rule.test ? rule.test(script) : rule.pattern.test(script);
      if (matched) {
        findings.push({ rule: rule.rule, severity: rule.severity, file: 'package.json', line: hookLine, explanation: `The ${hook} script: ${rule.explanation}` });
      }
    }

    for (const target of nodeScriptFiles(script)) {
      let file = path.resolve(root, target);
      if (!fs.existsSync(file) && fs.existsSync(`${file}.js`)) file = `${file}.js`;
      const relative = path.relative(root, file).split(path.sep).join('/');

      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        findings.push({ rule: 'outside-package', severity: 'medium', file: 'package.json', line: hookLine, explanation: `The ${hook} script runs "${target}", which is outside the package folder, so it was not scanned.` });
        continue;
      }
      if (scanned.has(file)) continue;
      scanned.add(file);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        findings.push({ rule: 'missing-script-file', severity: 'low', file: 'package.json', line: hookLine, explanation: `The ${hook} script runs "${target}", but that file is not in the package, so it could not be checked.` });
        continue;
      }
      findings.push(...scanSource(fs.readFileSync(file, 'utf8'), relative));
    }
  }

  // Only sensitive env access (whole object, secret-looking or computed names)
  // counts; reading e.g. HTTPS_PROXY before a download is normal.
  const network = findings.find((f) => f.rule === 'network');
  const env = findings.find((f) => f.rule === 'env-access' && f.severity !== 'low');
  if (network && env) {
    findings.unshift({
      rule: 'credential-exfiltration',
      severity: 'critical',
      file: network.file,
      line: network.line,
      explanation: `Possible credential exfiltration: reads sensitive environment variables (${env.file}:${env.line}) and makes network calls (${network.file}:${network.line}) during install.`,
    });
  }

  return { package: manifest.name || path.basename(root), risk: scoreFindings(findings), findings };
}

module.exports = { scanPackage };
