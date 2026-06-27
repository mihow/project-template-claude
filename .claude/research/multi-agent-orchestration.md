# Research: multi-agent orchestration patterns and economics

Findings on how to coordinate many cheaper workers under a strong orchestrator, and when doing
so actually pays off. This is the evidence base for the `sonnet-fleet` architecture. Compiled
2026-06-26, primarily from Anthropic engineering writeups plus the established multi-agent
literature. Confidence is labeled: **[Established]** = corroborated by well-known primary
sources; **[Emerging]** = single-source or recent, directionally useful but unreplicated.

## The one meta-finding

Across every reputable source the same lesson repeats: **start with one agent; add multi-agent
structure only when the task genuinely cannot fit one context or strongly benefits from
independent parallel exploration.** Coordination overhead and token cost are large and real.
**[Established]**

## What "frontier-tier" means here

The aspiration behind a Sonnet fleet is to approximate the top agentic tier — the long-horizon,
self-verifying capability of Anthropic's most capable models — at lower per-token cost. The
validated analog is Anthropic's published multi-agent research system: an Opus lead with Sonnet
subagents beat a single Opus agent by roughly 90% on their internal research eval, and
parallelization cut research time substantially on complex queries. That is the closest evidence
that "a strong orchestrator over many cheaper workers" can reach a quality a single cheaper agent
cannot. **[Established]**

## Pattern catalogue

Ordered from most-constrained (predefined code paths) to most-autonomous (the model directs
itself). Most work needs only the first few.

| Pattern | Use when | Confidence |
|---|---|---|
| Prompt chaining | Task decomposes into fixed sequential steps; accuracy over latency | [Established] |
| Routing | Inputs fall into distinct categories better served by specialized prompts/models | [Established] |
| Parallelization — sectioning | Genuinely independent subtasks run concurrently and join | [Established] |
| Parallelization — voting | Same task run N times and aggregated, when per-run accuracy already exceeds 50% | [Established] |
| Orchestrator-workers | Subtasks cannot be predicted in advance; the search space benefits from parallel exploration. **Core pattern for the harness.** | [Established] |
| Evaluator-optimizer | Clear evaluation criteria exist and iterative refinement measurably helps | [Established] |
| Reflection (self-critique) | Style/format tasks, or reasoning tasks with an external oracle; plateaus without one | [Established] |
| Debate / ensemble | Objective ground truth, genuine model diversity, and information asymmetry; ~6x+ cost | [Established] |
| Judge panel (jury) | Ranking open-ended outputs; a diverse jury of small models beats one big judge, more cheaply | [Established] |
| Loop-until-dry | Open-ended discovery — but only with explicit stop/convergence conditions | [Established] |

## Verification, ranked by leverage

The dominant empirical lesson: **external grounding is the biggest reliability lever; LLM
self-judgment alone is weak.**

1. **External-oracle verification** — route claims through a non-LLM check: compiler, tests,
   type-checker, linter, schema validator, real command output. For software/ops this is
   decisive: prefer "run the test" over "ask a critic if it looks right". **[Established]**
2. **Evidence-before-claims with provenance** — carry each finding's source through every handoff
   so a hallucinated intermediate does not become grounded context downstream; answer
   verification questions independently of the draft. **[Established]**
3. **Structured-output validation, with a known ceiling** — schema/constrained decoding gives high
   format compliance cheaply but does not buy semantic correctness. Validate leaf values, not just
   shape, and reject before any side effect. **[Established for the principle]**
4. **Self-consistency / majority voting — conditional** — helps only when per-sample accuracy
   exceeds 50% and samples are uncorrelated; it amplifies errors otherwise. Force diversity.
   **[Established]**
5. **Completeness critic / LLM-as-judge on the final artifact** — grade what was produced, not the
   path taken; swap pairwise order to fight position bias; judge with a different model family.
   **[Established]**
6. **Adversarial debate (N skeptics)** — genuinely useful but narrow: beats direct QA mainly under
   information asymmetry, at high cost. Reserve for high-value claims. **[Established]**
7. **Intrinsic self-repair** — lowest standalone leverage; a stronger model giving feedback beats
   same-model self-repair, and gains often vanish once cost is counted. **[Established]**

Two recurring production safeguards: a **hard short-circuit before side effects**, and
**verifying the verifier** — a buggy grader silently caps system quality. **[Established]**

## Context and decomposition rules of thumb

- **Isolate by construction.** Each worker gets its own context and never sees another's raw
  state; merging contradictory parallel work into one context degrades quality. **[Established]**
- **External store + condensed handoffs.** Workers write full output to disk and pass back a short
  summary plus a reference — this beats the "telephone problem" of copying large outputs through
  conversation history. **[Established]**
- **Fewer tools per worker.** Tool-selection accuracy falls as the toolset grows; give each worker
  a narrow, task-specific set. **[Established]**
- **Git worktrees for code mutation.** Each agent gets a private working tree from one shared
  object store; isolates code state (not environment state — watch ports and per-tree installs).
  **[Established]**
- **Scaling rules** (Anthropic's published anchors): simple fact-finding → 1 worker, 3–10 tool
  calls; comparison → 2–4 workers; complex divisible work → 10+ with divided responsibilities.
  **[Established]**
- **Most coding tasks are a weak fit for heavy fan-out** — they are full of inter-agent
  dependencies. Research, enumeration, and audit tasks fan out far better. **[Established]**

## Economics

- Agents use roughly **4x** the tokens of a chat turn; multi-agent systems roughly **15x** —
  justified only where the task value is high. **[Established]**
- **Token usage explains most of the performance variance** in these systems; spending more
  (more agents, more tool calls) is the lever, which is precisely why it must target high-value
  work. **[Established]**
- **Model choice can beat token budget** — upgrading the model often gives more than doubling the
  budget on a weaker one. **[Established]**
- The cheap-worker + strong-orchestrator topology is sound: routing and mixture-of-agents results
  show a strong aggregator over cheaper workers can match or beat a single expensive model, and
  the aggregator need not be the most expensive model. **[Established]**
- **Diminishing and negative returns are real.** Coordination helps parallelizable tasks and hurts
  sequential ones (large swings either way); accuracy can drop as agent count rises; homogeneous
  same-model voters share blind spots; errors compound super-linearly in uncoordinated chains.
  **[Emerging / directionally Established]**

## Native Claude Code fleet features (as of 2026)

- **Subagents** (stable) — dispatch workers with isolated contexts that report back to the lead;
  the primary mechanism. Workers cannot talk to each other, only to the lead.
- **The Workflow tool** — deterministic JS orchestration: `agent()/parallel()/pipeline()/phase()`,
  schema-forced structured output, per-agent worktree isolation, a token budget. The engine the
  templates target.
- **Agent teams** (experimental) — a peer model with a shared mailbox and self-claimed task list;
  more power, more failure modes (lagging status, no resume). Use only when workers must negotiate.
- **Agent View / background agents / scheduled agents** — monitoring and detached execution for
  many parallel sessions.

For routine fan-out, stable subagents plus the Workflow tool are the right foundation; reserve the
experimental peer features for cases that genuinely need worker-to-worker negotiation.

## The discipline

Always benchmark the fleet against **one strong agent given the same token budget** before
believing the multi-agent gain is structural rather than just more compute. Bound every loop with
a stop condition. Keep delegation flat. Aim the expensive paths only at high-value, parallelizable,
externally-verifiable work.

## Primary sources to read first

- Anthropic — Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- Anthropic — How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- Anthropic — Writing effective tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic — Demystifying evals for AI agents: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Anthropic — Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

Established literature behind specific claims includes Self-Consistency, Self-Refine, Reflexion,
CRITIC, Chain-of-Verification, Self-RAG, "LLMs Cannot Self-Correct Reasoning Yet", LLM-as-a-Judge /
MT-Bench, "Replacing Judges with Juries", RouteLLM, and Mixture-of-Agents. Recent (2026-stamped)
results referenced during research were left out where they could not be independently verified;
pull the originals before relying on any specific number.
