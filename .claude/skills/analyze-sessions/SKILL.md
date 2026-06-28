---
name: analyze-sessions
description: Study how an agent actually behaved by analyzing your own Claude Code session logs — quantify cheap signals first (tool use, message length, test-run frequency, completion claims, errors), then fan out qualitative analysis, then check for confounds. Useful for comparing two models on the same work, auditing an agent's discipline, or learning a model's failure modes from real transcripts.
disable-model-invocation: true
---

# Analyze your own sessions

Claude Code records every session as a JSONL transcript under
`~/.claude/projects/<encoded-project-path>/<session-id>.jsonl`, and each assistant entry
is tagged with the model that produced it. That is a rich, honest record of how an agent
behaved on real work — far more representative than a benchmark. This skill turns those
logs into findings.

It follows the same discipline as [`../sonnet-fleet/`](../sonnet-fleet/SKILL.md): measure
with an external oracle first, then use LLM judgment, then verify — here, verify the
*confound* that your own instructions shaped the behavior you are measuring.

## Step 1 — Quantify (deterministic, no LLM)

Run the bundled script to compute per-(session, model) metrics and extract one model's
turns into a readable file:

```bash
python .claude/skills/analyze-sessions/session_metrics.py \
  --logs '~/.claude/projects/**/*.jsonl' \
  --model claude-opus \
  --out ./session-analysis
```

It reports, per session and model: turns, tool calls per turn, top tools, median message
length, how often tests/linters were run, how often a completion was claimed, hedging
tics, tool errors, and how many turns used thinking. These cheap signals frame everything
else — e.g. "this model runs more tools per turn but claims done less often than that one."

To find which sessions used a given model at all:

```bash
grep -rIlE '"model"[[:space:]]*:[[:space:]]*"<model-id>"' ~/.claude/projects
```

## Step 2 — Analyze qualitatively (fan out)

For each session worth studying, have an analysis agent read its extract file and report
findings with **turn-number citations**, across these dimensions:

1. Planning & decomposition — does it explore before acting, or over-plan?
2. Tool-use profile — read-before-edit, search vs. guessing, tool mix.
3. Self-verification — does it run a real check, or assert?
4. Completion claims — is evidence attached, or is "done" premature?
5. Error recovery — diagnose-then-fix, or blind retry?
6. Long-horizon coherence — does quality drift over the session?
7. Verbosity & voice — message length, hedging, invented jargon bleeding into output.
8. Failure modes — stuck, looping, over-editing, over-generating, scope creep.

This is a natural `sonnet-fleet` fan-out: one analysis worker per session (each reads only
its own extract, isolated context), each returning structured findings, then an adversarial
pass on the surprising cross-cutting claims, then a synthesis. Instruct workers to be
adversarially honest — claim only what the turns show, mark confidence, note truncation.

## Step 3 — Check the confound (do not skip)

The behavior you measured was produced under *your* instructions. Before concluding "this
model is terse / careful / verbose," rule out that your setup caused it:

- Grep the sessions for your own steering: a terseness skill, a strict CLAUDE.md, a
  verification culture, scope rules. If they were active, they are a confound.
- **Compare two models within the same session.** Because the instructions were identical,
  any difference between the models isolates the model from your setup. This is the
  strongest counterfactual you can run without re-running the task.
- Beware misleading aggregates: median message length is deceptive when a model is bimodal
  (near-empty bridge turns plus a few dense synthesis turns). Look at the distribution.

Write the synthesis with measured, hedged language: separate what you observed from what you
infer, and state what would strengthen the finding (a counterfactual run, a paired same-task
comparison, a larger sample).

## Privacy

Session transcripts contain whatever you worked on — file paths, hostnames, credentials,
private code. Treat the extracts and metrics as sensitive. Never publish raw transcripts or
un-scrubbed extracts, and scrub deployment-specific identifiers before sharing any excerpt.
