// research-sweep.js — multi-angle research pattern for the sonnet-fleet harness.
//
// Answers a question by searching from several independent angles in parallel (each angle
// is blind to the others, so they surface different things), deduplicating the claims, then
// fact-checking each claim before it enters the synthesis. The synthesis stage aggregates;
// it does not introduce new claims.
//
// Adapt: the QUESTION (pass via args.question) and the ANGLES. Run via the Workflow tool.

export const meta = {
  name: 'research-sweep',
  description: 'Research a question from multiple independent angles in parallel, dedupe, fact-check each claim, then synthesize a cited answer',
  phases: [
    { title: 'Search', detail: 'one worker per angle' },
    { title: 'Verify', detail: 'fact-check each deduped claim' },
    { title: 'Synthesize', detail: 'aggregate verified claims into a cited answer' },
  ],
}

const QUESTION = (args && args.question) || 'State the research question via args.question'
const ANGLES = (args && args.angles) || [
  'primary/official sources and documentation',
  'independent practitioner reports and case studies',
  'criticism, failure modes, and counter-evidence',
  'recent developments and how the consensus has shifted',
]

const PREAMBLE = `You are a focused research worker. Follow these rules exactly:
1. SCOPE: Research only the assigned angle of the question.
2. EVIDENCE BEFORE CLAIMS: every claim must carry a source (URL or citation). Never state a
   claim you cannot attribute. Mark anything you could not verify as unverified.
3. Distinguish what a source establishes from your interpretation of it.
4. NO IRREVERSIBLE ACTIONS.
5. Return ONLY the JSON object matching the schema.`

const CLAIMS_SCHEMA = {
  type: 'object',
  required: ['claims'],
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'source', 'confidence'],
        properties: {
          claim: { type: 'string' },
          source: { type: 'string' },
          confidence: { enum: ['established', 'emerging', 'unverified'] },
        },
      },
    },
  },
}

const CHECK_SCHEMA = {
  type: 'object',
  required: ['holds', 'reason'],
  properties: {
    holds: { enum: ['yes', 'no', 'partial'] },
    reason: { type: 'string' },
    correctedClaim: { type: 'string' },
  },
}

// Search every angle in parallel. Barrier here is deliberate: we dedupe across the FULL set
// of claims before spending verification tokens, so the same claim is not checked twice.
phase('Search')
const searches = await parallel(
  ANGLES.map((angle, i) => () =>
    agent(`${PREAMBLE}\n\nQUESTION: ${QUESTION}\n\nYOUR ANGLE: ${angle}`, {
      label: `search:${i + 1}`,
      phase: 'Search',
      model: 'sonnet',
      effort: 'high',
      schema: CLAIMS_SCHEMA,
    }),
  ),
)

const seen = new Set()
const deduped = []
for (const r of searches.filter(Boolean)) {
  for (const c of r.claims || []) {
    const key = c.claim.trim().toLowerCase().slice(0, 80)
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(c)
    }
  }
}
log(`${deduped.length} unique claims to fact-check`)

// Fact-check each claim independently against its source.
const checked = await parallel(
  deduped.map((c) => () =>
    agent(
      `${PREAMBLE}\n\nFact-check this claim independently. Open the cited source if possible.\n` +
        `  CLAIM: ${c.claim}\n  SOURCE: ${c.source}\n  CLAIMED CONFIDENCE: ${c.confidence}\n\n` +
        `Does it hold? If not, give the corrected version.`,
      { label: 'verify-claim', phase: 'Verify', model: 'sonnet', effort: 'high', schema: CHECK_SCHEMA },
    ).then((chk) => ({ ...c, check: chk })),
  ),
)

const verified = checked.filter((c) => c.check && c.check.holds !== 'no')

// Synthesis aggregates only verified claims; it does not add new ones.
phase('Synthesize')
const report = await agent(
  `You are the synthesis agent. Write a cited answer to the question using ONLY the verified ` +
    `claims below. Group by theme, preserve each claim's source and confidence level, and ` +
    `surface any contradictions rather than hiding them. Do not introduce claims not in the list.\n\n` +
    `QUESTION: ${QUESTION}\n\nVERIFIED CLAIMS:\n${JSON.stringify(verified, null, 2)}`,
  { label: 'synthesize', phase: 'Synthesize', model: 'opus', effort: 'high' },
)

return { report, verifiedClaimCount: verified.length, droppedCount: checked.length - verified.length }
