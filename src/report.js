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

module.exports = { formatTable, formatSummary };
