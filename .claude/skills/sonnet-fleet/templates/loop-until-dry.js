// loop-until-dry.js — unknown-size discovery pattern for the sonnet-fleet harness.
//
// For finding an unknown number of things (bugs, edge cases, dead code, missing handlers):
// keep running rounds of finders until two consecutive rounds turn up nothing new. Each
// round dedupes against everything seen so far, and every fresh finding is adversarially
// verified before it counts. Deduping against `seen` (not against confirmed) is what makes
// the loop converge — otherwise rejected findings reappear every round forever.
//
// Adapt: the TARGET and the FINDERS (distinct search strategies). Run via the Workflow tool.

export const meta = {
  name: 'loop-until-dry',
  description: 'Discover an unknown-size set of issues by looping diverse finders until consecutive rounds find nothing new, verifying each fresh finding',
  phases: [
    { title: 'Find', detail: 'diverse finders per round' },
    { title: 'Verify', detail: 'adversarially confirm each fresh finding' },
  ],
}

const TARGET = (args && args.target) || 'the codebase under src/'
const DRY_ROUNDS_TO_STOP = (args && args.dryRounds) || 2
const MAX_ROUNDS = (args && args.maxRounds) || 6
const FINDERS = (args && args.finders) || [
  'Scan by control flow: branches, error paths, and early returns that are never exercised.',
  'Scan by data: inputs that are not validated, nullable values used without a guard.',
  'Scan by contract: callers that ignore a documented failure mode or return value.',
]

const PREAMBLE = `You are a focused discovery worker. Follow these rules exactly:
1. SCOPE: Search ${TARGET} using only your assigned strategy.
2. EVIDENCE BEFORE CLAIMS: cite file:line and quote the code for every issue.
3. NO IRREVERSIBLE ACTIONS.
4. Return ONLY the JSON object matching the schema.`

const FIND_SCHEMA = {
  type: 'object',
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'line'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          detail: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['real', 'reason'],
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
}

const seen = new Set()
const confirmed = []
let dry = 0
let round = 0

while (dry < DRY_ROUNDS_TO_STOP && round < MAX_ROUNDS) {
  round += 1

  // All finders for this round run in parallel (barrier: we need the full set to dedupe).
  const found = (
    await parallel(
      FINDERS.map((strategy, i) => () =>
        agent(`${PREAMBLE}\n\nSTRATEGY: ${strategy}`, {
          label: `find:r${round}:${i + 1}`,
          phase: 'Find',
          model: 'sonnet',
          effort: 'high',
          schema: FIND_SCHEMA,
        }),
      ),
    )
  )
    .filter(Boolean)
    .flatMap((r) => r.issues || [])

  const fresh = found.filter((issue) => {
    const key = `${issue.file}:${issue.line}:${issue.title}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (fresh.length === 0) {
    dry += 1
    log(`round ${round}: nothing new (${dry}/${DRY_ROUNDS_TO_STOP} dry rounds)`)
    continue
  }
  dry = 0

  // Verify each fresh issue adversarially before it counts.
  const judged = await parallel(
    fresh.map((issue) => () =>
      agent(
        `${PREAMBLE}\n\nA finder reports this issue:\n  ${issue.title}\n  ${issue.file}:${issue.line}\n` +
          `  ${issue.detail || ''}\n\nTry to REFUTE it. Open the file and read the code. ` +
          `Default to real=false if you cannot reproduce it.`,
        { label: `verify:r${round}`, phase: 'Verify', model: 'opus', effort: 'high', schema: VERDICT_SCHEMA },
      ).then((v) => ({ ...issue, real: !!(v && v.real), reason: v && v.reason })),
    ),
  )

  const realOnes = judged.filter((j) => j.real)
  confirmed.push(...realOnes)
  log(`round ${round}: ${fresh.length} fresh, ${realOnes.length} confirmed (${confirmed.length} total)`)
}

if (round >= MAX_ROUNDS && dry < DRY_ROUNDS_TO_STOP) {
  log(`stopped at the ${MAX_ROUNDS}-round cap before going dry — there may be more to find`)
}

return { confirmed, rounds: round }
