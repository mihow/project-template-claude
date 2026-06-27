// fan-out-verify.js — audit/review pattern for the sonnet-fleet harness.
//
// Reviews a target across several independent dimensions in parallel, then has an
// adversarial reviewer try to refute each finding before it is reported. Each dimension's
// findings are verified as soon as that dimension finishes (pipeline, no barrier), so a
// fast dimension does not wait on a slow one.
//
// Adapt: the DIMENSIONS list and the TARGET. Run via the Workflow tool. Sandboxed scripts
// cannot import, so the worker preamble and schemas are inlined from SCHEMAS.md.

export const meta = {
  name: 'fan-out-verify',
  description: 'Review a target across independent dimensions in parallel, then adversarially verify each finding before reporting',
  phases: [
    { title: 'Review', detail: 'one worker per dimension, in parallel' },
    { title: 'Verify', detail: 'adversarially refute each finding' },
  ],
}

// What to review and how to check a finding. Override via args when running.
const TARGET = (args && args.target) || 'the changes in `git diff` against the base branch'
const VERIFY_HINT = (args && args.verifyHint) || 'run the test suite, type-checker, and linter'
const DIMENSIONS = (args && args.dimensions) || [
  { key: 'correctness', prompt: 'Find correctness bugs: wrong logic, off-by-one, unhandled cases, broken contracts.' },
  { key: 'security', prompt: 'Find security issues: injection, auth/authz gaps, secret handling, unsafe input.' },
  { key: 'error-handling', prompt: 'Find silent failures: swallowed exceptions, ignored return values, fallbacks that hide errors.' },
  { key: 'tests', prompt: 'Find test gaps: untested branches, happy-path-only coverage, tests that assert nothing.' },
]

const PREAMBLE = `You are a focused worker subagent. Follow these rules exactly:
1. SCOPE: Do ONLY the assigned task. Report adjacent problems in scope_violations; do not fix them.
2. READ THE SPEC VERBATIM. Re-read it before you act and before you report.
3. EVIDENCE BEFORE CLAIMS: cite file:line and quote the code for every finding. No speculation about code you did not open.
4. NO IRREVERSIBLE ACTIONS (no push, delete, install, migrate, outbound writes).
5. SELF-CHECK before returning.
6. STAY IN BUDGET; if you run out, return what you have as blocked.
Return ONLY the JSON object matching the schema.`

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['status', 'findings'],
  properties: {
    status: { enum: ['done', 'blocked'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'line', 'detail', 'severity'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          detail: { type: 'string' },
          severity: { enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'reproduced', 'reason'],
  properties: {
    verdict: { enum: ['confirmed', 'refuted', 'needs-changes'] },
    reproduced: { type: 'string' },
    reason: { type: 'string' },
  },
}

// Each dimension flows through both stages independently — no barrier between them.
const reviewed = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `${PREAMBLE}\n\nTARGET: ${TARGET}\n\nTASK (${d.key}): ${d.prompt}`,
      { label: `review:${d.key}`, phase: 'Review', model: 'sonnet', effort: 'high', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review && review.findings ? review.findings : []).map((f) => () =>
        agent(
          `${PREAMBLE}\n\nA reviewer claims this issue in ${TARGET}:\n` +
            `  ${f.title}\n  ${f.file}:${f.line} — ${f.detail}\n\n` +
            `Try to REFUTE it. Open the file, read the code, and ${VERIFY_HINT}. ` +
            `Default to "refuted" if you cannot reproduce it. Report what you actually ran.`,
          { label: `verify:${d.key}:${f.file}`, phase: 'Verify', model: 'opus', effort: 'high', schema: VERDICT_SCHEMA },
        ).then((v) => ({ ...f, dimension: d.key, verdict: v })),
      ),
)

const all = reviewed.flat().filter(Boolean)
const confirmed = all.filter((f) => f.verdict && f.verdict.verdict === 'confirmed')
log(`${confirmed.length} of ${all.length} findings survived adversarial verification`)

return { confirmed, refuted: all.filter((f) => f.verdict && f.verdict.verdict === 'refuted') }
