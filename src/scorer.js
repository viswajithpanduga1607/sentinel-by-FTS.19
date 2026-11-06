// scorer.js: combines name risk and install-script risk for one dependency
// into a final score and a verdict (BLOCK, WARN or OK).

const BLOCK_AT = 70;
const WARN_AT = 40;
const BOTH_FIRE_BONUS = 10;

function verdictFor(risk) {
  if (risk >= BLOCK_AT) return 'BLOCK';
  if (risk >= WARN_AT) return 'WARN';
  return 'OK';
}

function formatFinding(finding) {
  const where = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  return `[${finding.severity}] ${where} ${finding.explanation}`;
}

/**
 * Final score: the higher of the two risks, plus 10 when both checks fire,
 * capped at 100. A local package that could not be scanned scores at least
 * WARN. The explanation lists every finding from both checks.
 *
 * @param {{name: string, risk: number, likelyIntended: string|null, reasons: string[]}} nameResult From checkName.
 * @param {{risk: number, findings: object[], error?: string}|null} [scriptResult] From scanPackage, or null if not scanned.
 */
function scoreDependency(nameResult, scriptResult = null) {
  const nameRisk = nameResult.risk;
  // A local package that could not be scanned cannot be vouched for, so it
  // counts as at least a WARN.
  const unscannable = Boolean(scriptResult && scriptResult.error);
  const scriptRisk = unscannable ? Math.max(WARN_AT, scriptResult.risk) : scriptResult ? scriptResult.risk : 0;
  const bothFire = nameRisk > 0 && scriptRisk > 0;
  const risk = Math.min(100, Math.max(nameRisk, scriptRisk) + (bothFire ? BOTH_FIRE_BONUS : 0));

  const explanation = nameResult.reasons.length
    ? nameResult.reasons.map((r) => `Name: ${r}`)
    : ['Name: No look-alike found.'];
  if (unscannable) {
    explanation.push(`Scripts: Could not scan the local package, so it is marked at least WARN (${scriptResult.error}).`);
  } else if (scriptResult && scriptResult.findings.length === 0) {
    explanation.push('Scripts: Install scripts scanned, nothing found.');
  } else if (scriptResult) {
    explanation.push(...scriptResult.findings.map((f) => `Scripts: ${formatFinding(f)}`));
  }
  if (bothFire) explanation.push(`Both checks fired, so ${BOTH_FIRE_BONUS} points were added.`);

  const intended = nameResult.likelyIntended;
  return {
    name: nameResult.name,
    risk,
    verdict: verdictFor(risk),
    likelyIntended: intended && intended !== nameResult.name.toLowerCase() ? intended : null,
    nameRisk,
    scriptRisk,
    explanation,
  };
}

module.exports = { scoreDependency, verdictFor, BLOCK_AT, WARN_AT };
