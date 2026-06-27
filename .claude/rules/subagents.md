---
paths:
  - "**/*"
---
# Subagent and Fleet Reliability Rules

These rules apply whenever you delegate work to subagents — a single helper, a parallel
fan-out, or the full `sonnet-fleet` harness. They exist because cheaper worker models fail
in predictable ways; each rule names the failure it prevents. The deeper rationale and the
runnable harness live in `.claude/skills/sonnet-fleet/`.

## When to delegate at all

Default to doing the task yourself in one context. Delegate only when the work is
**parallelizable** (disjoint units, no shared state), **high-value** (worth ~15× the tokens
of a single turn), and **externally verifiable** (each result checkable against a test,
type-checker, grep, or schema). Sequential, tightly-coupled, or low-value work is cheaper
and more reliable as a single agent — fan-out makes it worse, not better.

## The eight guardrails

1. **Plan gate.** Before any write-capable worker runs, get a structured plan approved
   (goal, non-goals, files to touch, acceptance criteria as checkboxes, rollback). Prevents
   scope creep and "but I only asked for X".
2. **Verbatim spec injection.** Put the original spec text into every worker call. Never a
   summary — summarizing is lossy and is itself a top cause of dropped requirements.
3. **Evidence-gated completion.** A worker may claim `done` only with real verification
   output pasted in. No output means `blocked`. Counters premature-completion bias.
4. **Adversarial review.** A separate reviewer sees the spec and the diff/output — never the
   worker's own summary — and tries to refute the result. Breaks self-referential verification.
5. **Per-role tool scoping.** Researchers get read-only tools; implementers can edit but not
   push or install; reviewers get read-only plus test runners. Contains blast radius.
6. **Re-initialize after compaction.** On a fresh or compacted context, re-read the spec and
   progress notes and re-run the verification before continuing. A compacted worker keeps its
   confidence but loses its competence.
7. **Hard iteration cap.** Give each worker a tool-call budget; exhausting it returns
   `blocked` with what's done and what remains — never a false `done`, never an endless loop.
8. **Irreversible-action deny-list.** `git push`, force-push, `reset --hard`, file deletion,
   package install, DB migration, and outbound writes to external services always require a
   human gate. The orchestrator never auto-approves them.

## Verification order

Prefer an **external oracle** over an LLM opinion. For code and ops work this means *run the
thing*: tests, type-check, lint, dry-run, real command output. Use an LLM reviewer to find
what the oracle cannot express (missing requirements, edge cases, silent failures), not as
the primary correctness check. And periodically check the checker — a buggy grader silently
caps the whole system's quality.

## Keep delegation flat

Orchestrator → workers, one level. Deep chains compound errors: a chain of 80%-accurate
steps that propagate mistakes lands near 0.8^N. Breadth with isolation does not have this
problem; depth does. If you need depth, add a verification gate at each handoff.
