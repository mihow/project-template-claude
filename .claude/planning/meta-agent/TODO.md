# CTO Sidekick - Active Todo List

Priority-ordered list of tasks. Top = highest priority.

## In Progress

- [ ] **Docker Compose Primary Implementation** ⭐ NEW PRIORITY
  - See: decisions/002-docker-compose-primary.md
  - Replace tmux with Docker containers
  - Orchestrator as container
  - Agent containers (one per project)
  - PostgreSQL for state
  - CSV priority file
  - System service via docker-compose

## Up Next (High Priority)

- [ ] **Credit Monitoring Implementation** (see: features/credit-monitoring.md)
  - Works with Docker containers
  - Monitor from orchestrator

- [ ] **LLM Task Verification** (see: features/llm-task-verification.md)
  - Decide if task needs planning
  - Verify task completion
  - Detect stuck agents
  - Generate test plans

## Medium Priority

- [ ] Multi-model routing (Claude → Qwen → Gemini)
- [ ] VM isolation per project
- [ ] Web dashboard
- [ ] Push notifications (ntfy.sh)

## Backlog

- [ ] Automatic session recording (tmux logging)
- [ ] Cost tracking per project
- [ ] Deadline-based re-prioritization
- [ ] GitHub Projects integration option
- [ ] CONTINUATION.md pattern for resume
- [ ] Pre-commit hooks for auto-testing
- [ ] Docker support as alternative to tmux

## Ideas / Maybe

- [ ] Voice notifications
- [ ] Slack integration
- [ ] Multiple concurrent projects
- [ ] Cloud + local hybrid mode
- [ ] Kubernetes orchestration

---

**Last Updated:** 2026-01-01
**Active Tasks:** 1
**Completed:** See DONE.md
