# Sonnet Fleet — canonical schemas, prompts, and routing

This file is the single source of truth for the guardrails the `sonnet-fleet` harness
relies on. Workflow-tool scripts run in a sandbox with no module imports, so copy the
blocks you need directly into your script or subagent prompt — do not try to `import`
them. Keeping one canonical copy here (rather than re-inventing the wording per script)
is what makes worker behavior consistent across patterns.

## Worker preamble

Prepend this verbatim to every worker task. It is the behavioral contract that
compensates for the known Sonnet failure modes (see
[`../../research/sonnet-failure-modes.md`](../../research/sonnet-failure-modes.md)).
Do not paraphrase it — paraphrasing is itself one of the failure modes it guards against.

```text
You are a focused worker subagent. Follow these rules exactly:

1. SCOPE: Do ONLY the assigned task. Do not touch files, install packages, or take
   actions outside the stated scope. If you find adjacent problems, report them in
   scope_violations — do not fix them.
2. READ THE SPEC VERBATIM: The task specification you are given is authoritative.
   Re-read it before you act and again before you report. Do not work from a
   paraphrase or from your memory of it.
3. EVIDENCE BEFORE CLAIMS: Never claim success you have not verified. Before
   returning status "done", run the verification command and paste its real output
   into evidence.command_output. No real output means status is "blocked", not "done".
4. NO IRREVERSIBLE ACTIONS: Never run anything on the deny-list (git push, force push,
   reset --hard, file deletion, package install, database migration, outbound network
   writes). If the task requires one, return status "blocked" and explain.
5. SELF-CHECK BEFORE RETURN: Re-read the task's acceptance criteria. For each, state
   pass or fail with evidence. If any fail, status is not "done".
6. STAY IN BUDGET: You have a tool-call budget. If you hit it before finishing, return
   status "blocked" with what is done and what remains — do not loop.

Return ONLY the JSON object matching the worker output schema. No prose around it.
```

## Worker output schema (evidence-gated)

Pass this as the `schema` option to `agent()` so the worker is forced to return a
validated object. The `evidence` object is never nullable.

```json
{
  "type": "object",
  "required": ["status", "summary", "evidence", "scope_violations", "open_questions"],
  "properties": {
    "status": { "enum": ["done", "blocked", "needs_clarification", "failed"] },
    "summary": { "type": "string" },
    "evidence": {
      "type": "object",
      "required": ["commands_run", "command_output", "files_changed", "verification"],
      "properties": {
        "commands_run": { "type": "array", "items": { "type": "string" } },
        "command_output": { "type": "string" },
        "files_changed": { "type": "array", "items": { "type": "string" } },
        "verification": { "type": "string" }
      }
    },
    "scope_violations": { "type": "array", "items": { "type": "string" } },
    "open_questions": { "type": "array", "items": { "type": "string" } }
  }
}
```

**The gate the orchestrator enforces:** a result with `status: "done"` but an empty
`evidence.command_output` is treated as `blocked`, not done. This single check is the
most effective countermeasure to premature-completion bias. Validation that the schema
*shape* is correct is not enough — check the leaf value.

## Reviewer verdict schema

The adversarial reviewer receives the original spec and the diff/output **only** — never
the worker's own summary. Its job is to refute, not approve.

```json
{
  "type": "object",
  "required": ["verdict", "criteria", "missing_or_wrong", "reproduced_verification", "recommendation"],
  "properties": {
    "verdict": { "enum": ["confirmed", "refuted", "needs_changes"] },
    "criteria": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["criterion", "met", "evidence"],
        "properties": {
          "criterion": { "type": "string" },
          "met": { "type": "boolean" },
          "evidence": { "type": "string" }
        }
      }
    },
    "missing_or_wrong": { "type": "array", "items": { "type": "string" } },
    "reproduced_verification": { "type": "string" },
    "recommendation": { "enum": ["land-as-is", "fix-then-land", "rework", "reject"] }
  }
}
```

## Irreversible-action deny-list

No worker may perform any of these without an explicit human gate. The orchestrator
never auto-approves them. This is a floor, not a ceiling — add to it per project.

- `git push`, `git push --force`, `git reset --hard`, history rewrites
- File or directory deletion (`rm`, `unlink`, truncating writes to tracked files)
- Package installation (`pip install`, `npm install`, `uv add`, system package managers)
- Database migrations or schema changes (`migrate`, `makemigrations`, raw DDL)
- Any outbound write to an external service (deploy, publish, POST/PUT/DELETE to a remote API, send mail)
- Editing files outside the task's declared file-ownership set

## Model and effort routing

Effort is a **reliability** dial, not only a cost dial: dropping a coding worker from
high to medium measurably degrades its judgment. Spend effort where correctness matters.

| Task | Model | Effort | Why |
|---|---|---|---|
| Decompose, plan, synthesize, final judgment | Opus (or Fable) | high / max | Novel, cross-cutting judgment — the part a Sonnet fleet is weakest at |
| Narrow implementation, focused search, single-file edit | Sonnet | high | The fleet's workhorse; high effort buys reliability |
| Adversarial verify, high stakes or hard to reverse | Opus | high | A Sonnet reviewer shares Sonnet's blind spots; break the symmetry |
| Adversarial verify, low stakes | Sonnet | high | Cheaper, with explicit "try to refute" framing |
| Mechanical reformat, rename, lint-fix, transcription | Haiku | medium | Bounded, low-judgment, cheapest |
| Local code Q&A, explanation | local model (e.g. Ollama) | — | Zero API cost |

## The eight guardrails (quick reference)

Each maps a Sonnet failure mode to the mechanism that contains it. Full rationale in
[`../../rules/subagents.md`](../../rules/subagents.md).

1. **Plan gate** — read-only planner approves a structured plan before any write-capable worker runs.
2. **Verbatim spec injection** — inject the original spec text into every call; never a summary.
3. **Evidence-gated completion** — `status: done` requires real verification output.
4. **Adversarial reviewer** — a separate agent gets spec + diff (not the worker's story) and tries to refute.
5. **Per-role tool scoping** — researchers read-only; implementers edit but cannot push; reviewers read-only.
6. **Re-init after compaction** — on a fresh context, re-read spec + progress notes + re-run the check before continuing.
7. **Hard iteration cap** — exhausting the tool budget returns `blocked`, never a false `done`.
8. **Irreversible-action deny-list** — the actions above always require a human gate.
