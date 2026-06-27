# Research: where Sonnet-class workers fail, and how to contain it

Findings on the weak points of cheaper worker models (Sonnet-class) when used as autonomous
subagents, and the conditions that trigger their mistakes. This is the evidence base for the
`sonnet-fleet` guardrails. Compiled 2026-06-26 from Anthropic primary sources, Anthropic
platform docs, and reported Claude Code issues. Tone is deliberately hedged: some items are
benchmark-measured, others are reported patterns — both are labeled.

## Why this matters for a fleet

A fleet's quality is bounded by how reliably each worker does its narrow job and how well the
orchestrator catches a worker that is wrong. So the design question is not "is Sonnet good" —
it is "where does Sonnet fail silently, and what structure catches it". Every guardrail in the
harness maps to one or more of the failure modes below.

## Weak points (relative to a frontier model)

| Weak point | Behavior | Evidence type |
|---|---|---|
| Long-context recall | Recall degrades sharply as context grows; large gap to frontier models on multi-needle retrieval benchmarks | Benchmark |
| Long-horizon coherence | Drifts on conditional branching and layered state over long agentic runs; more dead-ends | Benchmark + reported |
| Completion bias | Declares "done" on partial or wrong work, more so as context fills | Reported pattern |
| Specification drift | Treats exact format/spec as a guideline; each correction cycle adds new deviations | Reported pattern |
| Selective hearing | Parses the first keyword cluster of a multi-part instruction and silently drops the rest | Reported pattern |
| Post-compaction confidence | After compaction keeps its confident tone while having lost the reasoning and the spec | Reported pattern |
| Self-referential verification | "Verifies" by checking internal consistency, not against an external source of truth | Reported pattern |
| Tool avoidance / scope creep | Substitutes its own approach for a requested tool; edits or installs outside scope | Reported pattern |
| Irreversible actions | Will take hard-to-reverse actions without confirmation unless explicitly gated | Documented guidance |

## Conditions that trigger the failures

Listed roughly by how often they appear in practice.

1. **Vague or multi-part specs.** Bundling several requirements in one prompt is the primary
   trigger for selective hearing and drift. Repeating the spec louder does not fix it.
2. **Large or growing context.** Past tens of thousands of tokens, "context rot" sets in and
   recall falls; for cheaper models it falls fast.
3. **Continuation after compaction.** The model loses working memory but keeps behavioral
   confidence, so it continues marking work done with no signal of degradation.
4. **Iterative fix cycles on the same output.** Each round partially fixes the target while
   introducing new deviations, because the model works from a lossy memory of the spec instead
   of re-reading it.
5. **Implicit success criteria.** "Implement the feature" with no acceptance criteria makes the
   model fall back to a training prior of what a reasonable implementation looks like.
6. **Self-verification setups.** Asked to verify its own work, it checks the artifact against
   itself rather than against ground truth.
7. **Implicit tool invocation.** "Can you suggest…" yields suggestions, not action; imperative
   phrasing is needed to trigger the intended tool use.
8. **Conflicting instructions.** When a system rule and a user turn conflict, the model tends to
   default to accommodating the user turn over the guardrail.

## Mitigations that work (and map to guardrails)

These come from Anthropic's agent-building and prompting guidance, and from what actually broke
the reported failure loops.

- **Narrow, fully-specified delegation.** Each task needs an objective, an output format, tool
  and source guidance, and explicit boundaries. Brief task descriptions are the single most
  common root cause of coordination failure. → guardrails 1, 2, 5.
- **Inject the spec verbatim, re-read before each step.** Working from the exact text, not a
  summary, is what stopped the progressive-drift loop in practice. → guardrail 2.
- **Require evidence before a completion claim.** Force a verifiable artifact (test output, a
  diff, a grep result) before `done`; validate the value, not just the schema shape. → guardrail 3.
- **Adversarial review by a separate agent.** Give the reviewer the spec and the diff, withhold
  the worker's narrative, and tell it to refute. → guardrail 4.
- **Scope tools to the role.** Read-only for research and review; no push or install for
  implementers. → guardrail 5.
- **Re-initialize after compaction.** Re-read spec and progress notes and re-run the check before
  continuing. → guardrail 6.
- **Cap iterations; return blocked on exhaustion.** Prevents both burning tokens on a dead-end
  and silently giving up. → guardrail 7.
- **Gate irreversible actions.** A hard deny-list that the orchestrator never auto-approves. →
  guardrail 8.
- **Keep effort high on real work.** Reasoning effort is a reliability dial, not only a cost
  dial; dropping it measurably degrades judgment. Spend it where correctness matters.

## Primary sources

- Anthropic — Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- Anthropic — How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- Anthropic — Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic — Claude prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Anthropic — models overview (long-context benchmarks): https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic — Claude Code subagents: https://code.claude.com/docs/en/sub-agents

The "reported pattern" rows above are drawn from public Claude Code issue reports describing
completion bias, specification drift, and post-compaction behavior. They are reproductions
worth designing against, not controlled measurements — treat them as hypotheses the guardrails
defend against, confirmed by the mitigations that resolved them.
