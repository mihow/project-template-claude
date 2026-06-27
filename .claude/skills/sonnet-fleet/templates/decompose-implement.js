// decompose-implement.js — bounded implementation pattern for the sonnet-fleet harness.
//
// Turns a spec into code through three gates: (1) a read-only planner proposes a plan of
// independent, file-disjoint tasks with acceptance criteria; (2) each task is implemented by
// a worker in its OWN git worktree so parallel edits cannot clobber each other; (3) an
// adversarial reviewer checks each task's diff against that task's acceptance criteria before
// it is accepted. Implementation is the weakest fit for fan-out, so the planner MUST split the
// work into genuinely independent units — if it cannot, run the spec as a single agent instead.
//
// Adapt: pass the spec via args.spec. Run via the Workflow tool. Worktree isolation is real
// disk/setup cost, so it is used only for the implementation stage.

export const meta = {
  name: 'decompose-implement',
  description: 'Plan a spec into independent tasks, implement each in an isolated worktree, and adversarially review each diff against its acceptance criteria',
  phases: [
    { title: 'Plan', detail: 'read-only planner proposes independent tasks' },
    { title: 'Implement', detail: 'one worker per task, isolated worktree' },
    { title: 'Review', detail: 'adversarially check each diff vs its criteria' },
  ],
}

const SPEC = (args && args.spec) || 'State the implementation spec via args.spec'

const PLAN_SCHEMA = {
  type: 'object',
  required: ['parallelizable', 'tasks'],
  properties: {
    parallelizable: { type: 'boolean' },
    reason: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'goal', 'files', 'acceptance', 'verify'],
        properties: {
          id: { type: 'string' },
          goal: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          acceptance: { type: 'array', items: { type: 'string' } },
          verify: { type: 'string' },
        },
      },
    },
  },
}

// Guardrail 1: plan gate. The planner has no write tools — it only proposes.
phase('Plan')
const plan = await agent(
  `You are a planner. Read the codebase and the spec below. Produce a plan that splits the ` +
    `work into INDEPENDENT tasks whose file sets DO NOT OVERLAP, each with concrete, testable ` +
    `acceptance criteria and a verification command. If the work cannot be split into ` +
    `file-disjoint independent tasks, set parallelizable=false and explain — do not force it.\n\n` +
    `SPEC (authoritative, do not paraphrase):\n${SPEC}`,
  { label: 'plan', phase: 'Plan', model: 'opus', effort: 'high', schema: PLAN_SCHEMA },
)

if (!plan || !plan.parallelizable) {
  log('Planner judged the work not safely parallelizable. Run it as a single agent instead.')
  return { aborted: true, reason: plan && plan.reason, plan }
}

const PREAMBLE = `You are a focused implementation worker. Follow these rules exactly:
1. SCOPE: Edit ONLY the files listed for your task. Report anything else needed in scope_violations.
2. READ THE SPEC AND ACCEPTANCE CRITERIA VERBATIM. Re-read before you act and before you report.
3. EVIDENCE BEFORE CLAIMS: run the verification command and paste its real output. No output -> blocked.
4. NO IRREVERSIBLE ACTIONS (no push, no install without it being part of the task, no delete outside scope).
5. SELF-CHECK each acceptance criterion (pass/fail with evidence) before returning.
6. STAY IN BUDGET; if you run out, return blocked with progress.
Return ONLY the JSON object matching the schema.`

const RESULT_SCHEMA = {
  type: 'object',
  required: ['status', 'summary', 'evidence'],
  properties: {
    status: { enum: ['done', 'blocked', 'failed'] },
    summary: { type: 'string' },
    evidence: {
      type: 'object',
      required: ['command_output', 'files_changed'],
      properties: {
        command_output: { type: 'string' },
        files_changed: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'reproduced_verification', 'missing_or_wrong'],
  properties: {
    verdict: { enum: ['confirmed', 'refuted', 'needs-changes'] },
    reproduced_verification: { type: 'string' },
    missing_or_wrong: { type: 'array', items: { type: 'string' } },
  },
}

// Each task implements then reviews independently. Implementation runs in an isolated
// worktree; the reviewer is given the task's spec + criteria, NOT the worker's summary.
const results = await pipeline(
  plan.tasks,
  (task) =>
    agent(
      `${PREAMBLE}\n\nTASK ${task.id}: ${task.goal}\nFILES YOU MAY EDIT: ${task.files.join(', ')}\n` +
        `ACCEPTANCE CRITERIA:\n- ${task.acceptance.join('\n- ')}\n` +
        `VERIFY WITH: ${task.verify}\n\nFULL SPEC FOR CONTEXT:\n${SPEC}`,
      { label: `impl:${task.id}`, phase: 'Implement', model: 'sonnet', effort: 'high', isolation: 'worktree', schema: RESULT_SCHEMA },
    ),
  (result, task) =>
    agent(
      `You are an adversarial reviewer. Check task ${task.id} against its criteria. You are given ` +
        `the criteria and may inspect the diff and run the verification — you are NOT given the ` +
        `implementer's summary, on purpose. Try to find what the work does NOT do that the criteria ` +
        `require. Re-run the verification yourself; do not trust a pasted result.\n\n` +
        `ACCEPTANCE CRITERIA:\n- ${task.acceptance.join('\n- ')}\nVERIFY WITH: ${task.verify}`,
      { label: `review:${task.id}`, phase: 'Review', model: 'opus', effort: 'high', schema: VERDICT_SCHEMA },
    ).then((verdict) => ({ task: task.id, files: task.files, result, verdict })),
)

const clean = results.filter(Boolean)
const accepted = clean.filter((r) => r.verdict && r.verdict.verdict === 'confirmed')
const needsWork = clean.filter((r) => !r.verdict || r.verdict.verdict !== 'confirmed')
log(`${accepted.length}/${clean.length} tasks passed adversarial review`)

// Worktrees are left for the orchestrator to merge in plan order after review — merging is an
// integration decision, not a worker decision.
return { accepted, needsWork, plan }
