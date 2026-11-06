// report.js: formats scored results for output to the terminal.

const { createColors } = require('./colors');

const HEADERS = ['Package', 'Verdict', 'Risk', 'Likely intended', 'Explanation'];
const PLAIN = createColors(false);

function toRow(result) {
  return [result.name, result.verdict, String(result.risk), result.likelyIntended || '-', result.explanation];
}

function verdictColor(c, verdict) {
  if (verdict === 'BLOCK') return (text) => c.bold(c.red(text));
  if (verdict === 'WARN') return c.yellow;
  if (verdict === 'OK') return c.green;
  return String;
}

// Dims an explanation line, colouring a [critical] or [high] tag inside it.
function colorExplanation(c, line) {
  const match = /^(.*?)\[(critical|high)\](.*)$/.exec(line);
  if (!match) return c.dim(line);
  const [, before, severity, after] = match;
  const tag = severity === 'critical' ? c.red(`[${severity}]`) : c.yellow(`[${severity}]`);
  return `${c.dim(before)}${tag}${c.dim(after)}`;
}

/**
 * Plain-text table, highest risk first. Each explanation line gets its own
 * line under the Explanation column, and packages are separated by a blank line.
 * Widths are measured on the plain text, so colour codes never shift columns.
 *
 * @param {object[]} results Scored dependencies from scorer.scoreDependency.
 * @param {object} [c] Colour functions from colors.createColors; plain by default.
 */
function formatTable(results, c = PLAIN) {
  const sorted = [...results].sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name));
  const rows = sorted.map(toRow);
  const fixed = HEADERS.length - 1;
  const widths = HEADERS.slice(0, fixed).map((h, col) => Math.max(h.length, ...rows.map((row) => row[col].length)));
  const indent = ' '.repeat(widths.reduce((sum, w) => sum + w + 2, 0));
  const pad = (text, col, color = String) => color(text) + ' '.repeat(widths[col] - text.length);
  const plainCells = (row) => row.slice(0, fixed).map((cell, col) => pad(cell, col)).join('  ');

  const lines = [
    `${plainCells(HEADERS)}  ${HEADERS[fixed]}`,
    `${plainCells(widths.map((w) => '-'.repeat(w)))}  ${'-'.repeat(HEADERS[fixed].length)}`,
  ];
  rows.forEach((row, i) => {
    if (i > 0) lines.push('');
    const [name, verdict, risk, intended, explanation] = row;
    const cells = [
      pad(name, 0, c.cyan),
      pad(verdict, 1, verdictColor(c, verdict)),
      pad(risk, 2),
      pad(intended, 3, intended === '-' ? String : c.magenta),
    ].join('  ');
    const [first, ...rest] = explanation;
    lines.push(`${cells}  ${colorExplanation(c, first)}`);
    rest.forEach((line) => lines.push(`${indent}${colorExplanation(c, line)}`));
  });
  return lines.join('\n');
}

function formatSummary(results, c = PLAIN) {
  const count = (verdict) => results.filter((r) => r.verdict === verdict).length;
  const noun = results.length === 1 ? 'dependency' : 'dependencies';
  return `${results.length} ${noun} checked: ${c.red(`${count('BLOCK')} BLOCK`)}, ${c.yellow(`${count('WARN')} WARN`)}, ${c.green(`${count('OK')} OK`)}.`;
}

// ---- Colour-mode report: one card per dependency. Used only when colours are
// on; plain output always uses formatTable and formatSummary above.

const ICONS = { BLOCK: '✖', WARN: '▲', OK: '✔' };
const BADGES = { BLOCK: ' BLOCK ', WARN: ' WARN  ', OK: '  OK   ' };
const RULE_WIDTH = 64;

function tone(c, verdict) {
  if (verdict === 'BLOCK') return c.red;
  if (verdict === 'WARN') return c.yellow;
  return c.green;
}

function badge(c, verdict) {
  const bg = verdict === 'BLOCK' ? c.bgRed : verdict === 'WARN' ? c.bgYellow : c.bgGreen;
  const fg = verdict === 'BLOCK' ? c.white : c.black;
  return c.bold(bg(fg(BADGES[verdict])));
}

// Ten-block risk meter, e.g. ███████░░░  70
function riskMeter(c, result) {
  const filled = Math.round(result.risk / 10);
  const color = tone(c, result.verdict);
  return `${color('█'.repeat(filled))}${c.dim('░'.repeat(10 - filled))} ${color(String(result.risk).padStart(3))}`;
}

// One finding under a card, with a short coloured tag in front.
function findingLine(c, line, quiet) {
  const text = (t) => (quiet ? c.dim(t) : t);
  let m = /^Scripts: \[(critical|high|medium|low)\] (\S+) (.*)$/.exec(line);
  if (m) {
    const [, severity, where, rest] = m;
    const tags = { critical: c.bold(c.red('CRIT')), high: c.yellow('HIGH'), medium: c.magenta('MED '), low: c.dim('LOW ') };
    return `${tags[severity]}  ${c.dim(where)}  ${text(rest)}`;
  }
  m = /^(Name|Scripts): (.*)$/.exec(line);
  if (m) return `${c.cyan(m[1] === 'Name' ? 'NAME' : 'SCAN')}  ${text(m[2])}`;
  return `${c.magenta('BOTH')}  ${text(line)}`;
}

function verdictLine(c, counts) {
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (counts.BLOCK) return c.bold(c.red(`${ICONS.BLOCK} verdict: don't install yet. ${plural(counts.BLOCK, 'package looks', 'packages look')} sus.`));
  if (counts.WARN) return c.bold(c.yellow(`${ICONS.WARN} verdict: proceed with caution. review ${plural(counts.WARN, 'flagged package', 'flagged packages')} first.`));
  return c.bold(c.green(`${ICONS.OK} verdict: all clear. ship it.`));
}

/**
 * Colour-mode report: scan header, one card per dependency (verdict badge,
 * risk meter and a tree of findings) and a footer with the overall verdict.
 *
 * @param {object[]} results Scored dependencies from scorer.scoreDependency.
 * @param {object} c Colour functions from colors.createColors (enabled).
 * @param {{target?: string, scanned?: number, elapsedMs?: number}} [meta]
 */
function formatFancy(results, c, { target, scanned = 0, elapsedMs } = {}) {
  const sorted = [...results].sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name));
  const counts = { BLOCK: 0, WARN: 0, OK: 0 };
  sorted.forEach((r) => { counts[r.verdict]++; });
  const label = (r) => r.name + (r.likelyIntended ? ` → ${r.likelyIntended}` : '');
  const labelWidth = Math.max(...sorted.map((r) => label(r).length));
  const prompt = c.green('›');
  const rule = c.dim('─'.repeat(RULE_WIDTH));

  const lines = [];
  if (target) lines.push(`${prompt} ${c.dim('target')}  ${target}`);
  lines.push(`${prompt} ${c.dim('deps  ')}  ${sorted.length} found ${c.dim('·')} ${scanned} local ${scanned === 1 ? 'package' : 'packages'} scanned`);
  lines.push(`${prompt} ${c.dim('mode  ')}  names + install scripts ${c.dim('(static, nothing runs)')}`);
  lines.push('', rule);

  for (const r of sorted) {
    const name = c.bold(c.cyan(r.name)) + (r.likelyIntended ? `${c.dim(' → ')}${c.magenta(r.likelyIntended)}` : '');
    const padding = ' '.repeat(labelWidth - label(r).length);
    lines.push('', ` ${tone(c, r.verdict)(ICONS[r.verdict])}  ${name}${padding}  ${badge(c, r.verdict)}  ${riskMeter(c, r)}`);
    r.explanation.forEach((line, i) => {
      const branch = i === r.explanation.length - 1 ? '└─' : '├─';
      lines.push(`    ${c.dim(branch)} ${findingLine(c, line, r.verdict === 'OK')}`);
    });
  }

  const dot = c.dim('·');
  const timing = elapsedMs === undefined ? '' : `   ${c.dim(`scanned in ${elapsedMs}ms`)}`;
  lines.push('', rule);
  lines.push(`  ${c.red(`${counts.BLOCK} BLOCK`)}  ${dot}  ${c.yellow(`${counts.WARN} WARN`)}  ${dot}  ${c.green(`${counts.OK} OK`)}${timing}`);
  lines.push(`  ${verdictLine(c, counts)}`);
  return lines.join('\n');
}

module.exports = { formatTable, formatSummary, formatFancy };
