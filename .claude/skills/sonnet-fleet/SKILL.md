---
name: sonnet-fleet
description: Run a goal as an orchestrated fleet — a strong orchestrator (Opus) decomposes the work, fans it out to many narrow Sonnet workers, verifies each result adversarially, then synthesizes. Use for high-value, parallelizable, externally-verifiable work such as multi-file audits and reviews, research sweeps, unknown-size discovery, and bounded implementation plans. Not for sequential, tightly-coupled, or low-value tasks — those are cheaper and more reliable as a single agent.
disable-model-invocation: true
---

# Sonnet Fleet

Reach the quality of a single frontier agent on large, parallelizable work by running a
**team of cheaper Sonnet workers under an Opus orchestrator**, with verification built in.
This mirrors the architecture Anthropic published for their multi-agent research system,
where an Opus lead with Sonnet subagents outperformed a single Opus agent by roughly 90%
on their internal research evaluation. The gain is real but conditional — it shows up on
parallelizable, verifiable work and reverses on sequential, tightly-coupled work.

The harness exists to compensate for where Sonnet workers are weakest (premature "done"
claims, spec drift on multi-part instructions, self-referential verification, lost
competence after context compaction). It does that with eight guardrails, summarized in
[`SCHEMAS.md`](SCHEMAS.md) and explained in [`../../rules/subagents.md`](../../rules/subagents.md).

## Step 0 — decide whether to fan out at all

This is the single highest-leverage decision. Adding agents costs roughly 15× the tokens
of a single chat turn, so the work has to be worth it. Default to **one agent** and only
fan out when all three hold:

- **Parallelizable** — the goal splits into units that touch disjoint files/areas and do
  not depend on each other's output. (Most coding tasks are *not* this; most audits,
  research sweeps, and enumeration tasks *are*.)
- **High-value** — the cost of the fleet is justified by the cost of being wrong or slow.
- **Externally verifiable** — each unit's result can be checked against an oracle (a test,
  a type-checker, a grep, a schema, a real command), not just "looks right".

If any of these is false, stop and do the task as a single agent. Say so, and why.

## Pick a pattern

| Pattern | Use when | Template |
|---|---|---|
| **Fan-out + verify** | Audit, multi-dimension review, or any "find issues across N areas" goal | [`templates/fan-out-verify.js`](templates/fan-out-verify.js) |
| **Research sweep** | A question that needs many search angles, deduped and fact-checked | [`templates/research-sweep.js`](templates/research-sweep.js) |
| **Decompose + implement** | A bounded plan of mostly-independent changes, each verifiable | [`templates/decompose-implement.js`](templates/decompose-implement.js) |
| **Loop-until-dry** | Unknown-size discovery (bugs, edge cases) — keep going until rounds come up empty | [`templates/loop-until-dry.js`](templates/loop-until-dry.js) |

Sizing, per Anthropic's published scaling rules: a simple lookup needs **one** worker;
a direct comparison needs **2–4**; only genuinely complex, divisible work justifies **10+**.

## How to run it

### Preferred: the Workflow tool

If the `Workflow` tool is available, the templates are runnable scripts. Copy the closest
template, adapt the goal-specific parts (the dimensions, the file list, the question), and
run it. The Workflow tool gives deterministic control flow, schema-forced structured output
(`agent({schema})`), `parallel()`/`pipeline()` fan-out, per-agent worktree isolation, and a
token budget. Scripts run sandboxed — no imports — so each template is self-contained; the
canonical prompt and schema blocks come from [`SCHEMAS.md`](SCHEMAS.md), pasted in.

### Fallback: plain parallel subagent dispatch

If the Workflow tool is not available, run the same shape by dispatching subagents directly
(see the `dispatching-parallel-agents` skill): send multiple `Agent` calls in one message
for the fan-out stage, collect their structured results, then dispatch the
`adversarial-reviewer` agent per finding, then synthesize yourself. You lose deterministic
looping and the token budget, but the guardrails are identical.

Either way, workers are the `fleet-worker` agent ([`../../agents/fleet-worker.md`](../../agents/fleet-worker.md))
and reviews go to the `adversarial-reviewer` agent ([`../../agents/adversarial-reviewer.md`](../../agents/adversarial-reviewer.md)).

## Orchestrator checklist

You are the orchestrator. Hold these; they are the part a Sonnet worker cannot do for you.

- [ ] Confirmed the Step 0 gate (parallelizable, high-value, verifiable) — or chose a single agent.
- [ ] Wrote the canonical spec once and will inject it **verbatim** into every worker (guardrail 2).
- [ ] Mapped disjoint file ownership so workers cannot clobber each other (use worktrees for mutations).
- [ ] Gave each worker an isolated, narrow brief: objective, output format, tools, boundaries.
- [ ] Forced the evidence-gated output schema; will reject `done` without real verification output (guardrail 3).
- [ ] Routed verification through an external oracle first (run the test), not an LLM opinion.
- [ ] Sent each non-trivial result to an adversarial reviewer that sees the diff, not the worker's story (guardrail 4).
- [ ] Kept delegation **flat** (orchestrator → workers), not deep chains — depth compounds errors.
- [ ] Synthesized by comparison, keeping source + confidence labels; did not blind-concatenate.
- [ ] Held every irreversible action behind a human gate (guardrail 8).
- [ ] Sanity-checked the result against what a single strong agent would have produced.

## Cost note

Token spend, not cleverness, explains most of the performance difference in fan-out
systems — which is exactly why it must be aimed only at work that earns it. For a small or
sequential task, one Sonnet (or Haiku) agent is both cheaper and more reliable than a fleet.
When in doubt, run the single-agent baseline first and only escalate to the fleet if it
falls short.
