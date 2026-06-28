# Learnings from analyzing real agent session logs

Claude Code keeps a full transcript of every session, tagged with the model that produced each
turn. That is an honest record of how an agent behaved on real work — more representative than any
benchmark. This note captures transferable, model-agnostic learnings from studying such logs (the
[`analyze-sessions`](../skills/analyze-sessions/SKILL.md) skill is the tooling; this is the why).

These are observations from a small, instruction-shaped sample, framed as hypotheses, not laws.

## 1. Agents are highly steerable — guardrails do most of the work

The clearest finding: a strong, explicit instruction set measurably changes behavior. In sessions
run under a strict project `CLAUDE.md` (a verification culture, scope limits, an explicit
destructive-action protocol), the failure modes that get reported for frontier models — claiming
work "verified" without running it, bypassing approval gates — largely **did not appear**. The
agent paused before every irreversible action (a destructive migration, deleting data, publishing
to an external service) and asked, and it backed completion claims with commit hashes and command
output. The lever that produced disciplined behavior was the instruction set, and it worked.

The practical implication: invest in `CLAUDE.md` and rules. Most "the model did something reckless"
failures are really "nothing told it not to." The
[verification](../rules/verification.md) and [subagent guardrail](../rules/subagents.md) rules in
this template exist for exactly this reason.

## 2. A few failure modes resist instructions — target them explicitly

Two tendencies leaked through even strong guardrails, so they are worth an explicit instruction:

- **Prose and comment over-generation.** Agents narrate — comments that explain what the next line
  does, PR descriptions that run to many hundreds of words, options surveyed that won't be taken.
  Code edits stayed tight; the over-generation was in *prose*. Counter it directly: "don't write
  narrating comments; keep PR descriptions tight" (this template's
  [comment guidance](../../CLAUDE.md) covers the spirit).
- **Working-vocabulary bleed.** During a long task an agent coins shorthand for the problem at hand
  and then uses those coined terms, undefined, in reader-facing output (PR bodies, summaries). Add:
  "leave the vocabulary you built up while working behind; write for a reader who wasn't there."

## 3. Version-control and tool-state handling is a weak spot

The single clearest failure observed was **blind retry on a failed state-mutating command** — an
agent re-issued a `git stash` half a dozen times with no diagnostic step between attempts before
abandoning the approach. Run-then-fix behavior clustered on *environment/tool state* (git, flaky
CI, sandbox), not on code logic, where the same agent was careful. A useful guardrail: **diagnose a
failed state-changing command before retrying it** — this is the same principle as the
"verify the error before retrying" rule in the [subagent guardrails](../rules/subagents.md).

## 4. Verify-by-inspection is not verify-by-test

Comparing two model generations on the same projects, one verified far more by *reading* (greps,
SSH state checks, cross-reading files) than by *running the test suite*, and ran noticeably fewer
explicit test commands. Inspection is real verification, but it is not the same guarantee as a
green test run. If you want tests actually executed, say so — don't assume "verify your work" will
be read as "run the suite."

## 5. How to measure without fooling yourself

- **Cheap signals first.** Count tool calls per turn, message lengths, test-run frequency,
  completion-claim phrases, and tool errors before asking any model to interpret anything. These
  deterministic numbers frame the qualitative read and keep it honest.
- **Median length lies when behavior is bimodal.** Agents tend to alternate near-empty "bridge"
  turns with a few long, dense synthesis turns. A single median hides that; look at the
  distribution. The same agent can look "terse" in one session and "verbose" in another purely from
  the ratio of bridge to synthesis turns.
- **Your instructions are a confound.** You cannot conclude "this model is careful/terse" from logs
  produced under your own strict setup. The strongest counterfactual you can run without redoing the
  work is to **compare two models within the same session** — identical instructions, so any
  difference isolates the model. Doing this showed that one model was genuinely terser than another
  under the same terseness instruction, i.e. the trait was partly intrinsic, not purely induced.
- **Hedge the writeup.** Separate what you observed from what you infer; say what would strengthen
  each finding (a counterfactual run, a paired same-task comparison, a larger sample).

## Applying it

The [`analyze-sessions`](../skills/analyze-sessions/SKILL.md) skill runs the quant pass; the
[`sonnet-fleet`](../skills/sonnet-fleet/SKILL.md) fan-out is a natural fit for the qualitative pass
(one analysis worker per session, each citing turn numbers, then an adversarial check, then a
synthesis). Treat the extracts as sensitive — session logs contain whatever you worked on — and
never publish raw transcripts or un-scrubbed excerpts.
