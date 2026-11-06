// report.js: formats scored results for output to the terminal.

const HEADERS = ['Package', 'Verdict', 'Risk', 'Likely intended', 'Explanation'];

function toRow(result) {
  return [result.name, result.verdict, String(result.risk), result.likelyIntended || '-', result.explanation];
}

// Plain-text table, highest risk first. Each explanation line gets its own
// line under the Explanation column, and packages are separated by a blank line.
function formatTable(results) {
  const sorted = [...results].sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name));
  const rows = sorted.map(toRow);
  const fixed = HEADERS.length - 1;
  const widths = HEADERS.slice(0, fixed).map((h, col) => Math.max(h.length, ...rows.map((row) => row[col].length)));
  const indent = ' '.repeat(widths.reduce((sum, w) => sum + w + 2, 0));
  const cells = (row) => row.slice(0, fixed).map((cell, col) => cell.padEnd(widths[col])).join('  ');

  const lines = [
    `${cells(HEADERS)}  ${HEADERS[fixed]}`,
    `${cells(widths.map((w) => '-'.repeat(w)))}  ${'-'.repeat(HEADERS[fixed].length)}`,
  ];
  rows.forEach((row, i) => {
    if (i > 0) lines.push('');
    const [first, ...rest] = row[fixed];
    lines.push(`${cells(row)}  ${first}`);
    rest.forEach((line) => lines.push(`${indent}${line}`));
  });
  return lines.join('\n');
}

function formatSummary(results) {
  const count = (verdict) => results.filter((r) => r.verdict === verdict).length;
  const noun = results.length === 1 ? 'dependency' : 'dependencies';
  return `${results.length} ${noun} checked: ${count('BLOCK')} BLOCK, ${count('WARN')} WARN, ${count('OK')} OK.`;
}

module.exports = { formatTable, formatSummary };
