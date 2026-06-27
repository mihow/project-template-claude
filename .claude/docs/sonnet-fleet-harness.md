# The Sonnet Fleet Harness — design and rationale

A harness for reaching the quality of a single frontier agent on large, parallelizable work
by coordinating a **team of cheaper Sonnet workers under a strong (Opus) orchestrator**, with
verification built into the structure rather than bolted on. This document explains why the
harness is shaped the way it is. The runnable pieces live in
[`../skills/sonnet-fleet/`](../skills/sonnet-fleet/); the supporting research is in
[`../research/`](../research/).

## The goal, stated precisely

The aim is to approximate frontier-tier agentic quality — long-horizon, self-verifying,
reliable — without paying frontier-tier per-token prices, by spending cheaper Sonnet tokens in
parallel. This is not a free win. The closest published, validated analog is Anthropic's own
multi-agent research system, where an Opus lead with Sonnet subagents outperformed a single
Opus agent by about 90% on their internal research evaluation. That result is real, and it is
conditional: the gain appears on parallelizable, externally-verifiable work and reverses on
sequential, tightly-coupled work, where coordination overhead and compounding errors make a
fleet worse than one good agent.

## When a fleet wins, and when it loses

A fleet is the right tool only when three conditions hold at once:

1. **Parallelizable** — the work splits into units that touch disjoint areas and do not depend
   on each other's output. Audits, reviews across dimensions, research sweeps, and enumeration
   fit this well. Most coding tasks do not: they are full of inter-file dependencies, and the
   published evidence is that multi-agent coordination helps parallelizable tasks substantially
   while hurting sequential ones, sometimes badly.
2. **High-value** — multi-agent runs cost on the order of fifteen times the tokens of a single
   chat turn. Token spend, more than any other factor, explains the performance difference in
   these systems, which is exactly why it must be aimed only at work worth the price.
3. **Externally verifiable** — each unit's result can be checked against an oracle (a test, a
   type-checker, a grep, a schema, a real command), not merely judged to "look right".

If any condition fails, the honest move is to run a single agent. The harness makes this the
explicit first gate, because skipping it is the most common and most expensive mistake.

## Why the guardrails exist: Sonnet's failure modes

Cheaper worker models fail in predictable ways. The harness is essentially a set of structural
countermeasures to those failures (the evidence is collected in
[`../research/sonnet-failure-modes.md`](../research/sonnet-failure-modes.md)):

| Failure mode | Trigger | Countermeasure (guardrail) |
|---|---|---|
| Premature "done" on partial work | high context use, vague success criteria | Evidence-gated completion (3) |
| Spec drift, dropped clauses | vague or multi-part instructions | Verbatim spec injection (2) |
| New deviations each fix cycle | iterative correction from memory | Verbatim spec re-read (2), plan gate (1) |
| Confident but incompetent after compaction | context compaction | Re-initialize after compaction (6) |
| Self-referential verification | "verify your own work" | Adversarial reviewer (4) |
| Scope creep, irreversible actions | implicit instructions | Per-role tool scoping (5), deny-list (8) |
| Endless looping or silent giving-up | dead-end tasks, no budget | Hard iteration cap (7) |

## The eight guardrails

1. **Plan gate.** A read-only planner approves a structured plan (goal, non-goals, files,
   acceptance criteria, rollback) before any write-capable worker runs.
2. **Verbatim spec injection.** The original spec text is injected into every worker call.
   Summaries are lossy and are themselves a leading cause of dropped requirements.
3. **Evidence-gated completion.** A worker may claim `done` only with real verification output
   attached; otherwise the orchestrator downgrades it to `blocked`.
4. **Adversarial review.** A separate reviewer receives the spec and the diff — never the
   worker's own narrative — and is told to refute, not approve.
5. **Per-role tool scoping.** Researchers get read-only tools, implementers can edit but not
   push or install, reviewers get read-only plus test runners.
6. **Re-initialize after compaction.** On a fresh or compacted context, re-read the spec and
   progress notes and re-run verification before continuing.
7. **Hard iteration cap.** A tool-call budget that, when exhausted, returns `blocked` with
   progress — never a false `done`, never an endless loop.
8. **Irreversible-action deny-list.** Push, force-push, hard reset, deletion, install,
   migration, and outbound writes always require a human gate.

The canonical wording of the worker preamble, the schemas, and the deny-list lives in
[`../skills/sonnet-fleet/SCHEMAS.md`](../skills/sonnet-fleet/SCHEMAS.md) so every pattern uses
identical, consistent guardrails.

## Architecture

The topology is deliberately **flat**: one orchestrator, many workers, one level deep. Deep
chains compound errors — a chain of 80%-accurate steps that propagate mistakes lands near
0.8 to the Nth — whereas breadth with isolation does not have that problem. Workers run in
**isolated contexts** and never see each other's raw state; for code mutations they run in
separate git worktrees so parallel edits cannot collide. Workers write full output to disk and
return a **condensed** result, which keeps the orchestrator's context from saturating and
oversummarizing (the "telephone problem"). The orchestrator does the parts a Sonnet worker is
weakest at — decomposition, cross-cutting judgment, and synthesis-by-comparison — and routes
everything else down.

## Verification comes first

For code and ops work, the highest-leverage reliability lever is not a smarter critic but an
**external oracle**: run the test, the type-checker, the linter, the dry-run, the real command.
LLM review is used to catch what an oracle cannot express — missing requirements, edge cases,
silent failures — not as the primary correctness check. And the checker itself is checked
periodically, because a buggy grader silently caps the quality of everything downstream.

## The four patterns

| Pattern | Use when | Template |
|---|---|---|
| Fan-out + verify | Audit or multi-dimension review | `fan-out-verify.js` |
| Research sweep | A question needing many search angles | `research-sweep.js` |
| Decompose + implement | A bounded plan of independent changes | `decompose-implement.js` |
| Loop-until-dry | Unknown-size discovery | `loop-until-dry.js` |

Each is a self-contained Workflow-tool script. Where the Workflow tool is unavailable, the same
shapes run with plain parallel subagent dispatch (the `dispatching-parallel-agents` skill) — the
control flow is manual but the guardrails are unchanged.

## The discipline that keeps it honest

Before trusting that a fleet beat the alternative, compare it against **one strong agent given
the same token budget**. Much of what looks like a multi-agent win is simply more compute and
more context; keep the fan-out only where it demonstrably outperforms that baseline. Bound every
loop with a stop condition, size the worker count to the task (one worker for a lookup, a few
for a comparison, many only for genuinely large divisible work), and never let a fleet run on
work that a single agent would do more cheaply and more reliably.

## A note on how this was built

This harness was itself assembled with the pattern it describes: a strong orchestrator ran
parallel Sonnet research workers (failure modes, orchestration patterns, an inventory of
existing building blocks), then delegated the well-specified files to Sonnet workers while
authoring the cross-cutting, judgment-heavy pieces directly. The division of labor — workers for
bounded, verifiable units; the orchestrator for coherence and judgment — is the same one the
harness prescribes.

## Sources

The primary sources behind these decisions are listed in the research documents:
[`../research/sonnet-failure-modes.md`](../research/sonnet-failure-modes.md) and
[`../research/multi-agent-orchestration.md`](../research/multi-agent-orchestration.md). The
anchor references are Anthropic's "Building Effective Agents", "How we built our multi-agent
research system", and "Effective context engineering for AI agents".
