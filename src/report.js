// report.js: formats scored results for output to the terminal.

const HEADERS = ['Package', 'Risk', 'Likely intended', 'Reason'];

function toRow(result) {
  const intended = result.likelyIntended && result.likelyIntended !== result.name.toLowerCase() ? result.likelyIntended : '-';
  const reason = result.reasons.join(' ') || 'No look-alike found.';
  return [result.name, String(result.risk), intended, reason];
}

// Plain-text table, highest risk first. The last column is not padded so
// long reasons do not push trailing spaces onto every line.
function formatTable(results) {
  const sorted = [...results].sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name));
  const rows = [HEADERS, ...sorted.map(toRow)];
  const widths = HEADERS.slice(0, -1).map((_, col) => Math.max(...rows.map((row) => row[col].length)));
  const line = (row) => row.map((cell, col) => (col < widths.length ? cell.padEnd(widths[col]) : cell)).join('  ');
  const divider = [...widths.map((w) => '-'.repeat(w)), '-'.repeat(HEADERS[HEADERS.length - 1].length)];
  return [line(rows[0]), line(divider), ...rows.slice(1).map(line)].join('\n');
}

function formatSummary(results, highRisk) {
  const flagged = results.filter((r) => r.risk >= highRisk).length;
  const noun = results.length === 1 ? 'dependency' : 'dependencies';
  return `${results.length} ${noun} checked, ${flagged} at or above risk ${highRisk}.`;
}

module.exports = { formatTable, formatSummary };
