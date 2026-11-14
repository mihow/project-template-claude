# Template scout

A prompt for a scheduled Claude Code session that keeps this template current.
It replaces the old weekly docs-snapshot workflow, which reported that pages had
changed without saying what changed or what to do about it.

**Suggested schedule:** monthly, as a scheduled task that starts a fresh cloud
session on this repository. **Output:** at most one pull request. If nothing
needs to change, the session ends without creating anything.

## Prompt

You maintain a Claude-first Python project template. Your job is to find what
has changed in Claude Code and the surrounding tooling since the last update and
bring the template in line with it. Change only what you can verify.

### 1. Read the current state

Read `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, everything under
`.claude/hooks/`, `.claude/skills/`, `.claude/agents/` and `.claude/rules/`, the
workflows in `.github/workflows/`, and the "Last scout" section at the end of
this file.

### 2. Research

Read the current version of each source and compare it with what the template
does. Read the pages themselves; do not rely on memory.

- Claude Code changelog: https://code.claude.com/docs/en/changelog (entries since the last scout date)
- Best practices: https://code.claude.com/docs/en/best-practices
- Memory and instructions: https://code.claude.com/docs/en/memory
- Skills: https://code.claude.com/docs/en/skills
- Subagents: https://code.claude.com/docs/en/sub-agents
- Hooks: https://code.claude.com/docs/en/hooks-guide
- Settings and permissions: https://code.claude.com/docs/en/settings and https://code.claude.com/docs/en/permissions
- GitHub Actions: https://code.claude.com/docs/en/github-actions and https://github.com/anthropics/claude-code-action
- uv, ruff and pyright release notes, for changes to the commands and config this template uses

Then search the web for practitioner write-ups from the same period (for
example Simon Willison's `coding-agents` tag) and note any technique that would
change how the template should be set up.

### 3. Decide

For each difference, ask: does the template do something that no longer works,
that is now built in, or that the docs now advise against? Is there a new
feature that a new project would want on day one? Ignore anything that is only
new, not better. Prefer removing to adding: the template should stay small.

### 4. Change and verify

Make the changes on a branch. Verify each one the way `AGENTS.md` says: run
`make ci` and `make verify`, run hook scripts directly with sample input, lint
workflows with `uvx --from actionlint-py actionlint`, and check that every
action input you use exists in that action's `action.yml` at the pinned tag.
Do not include a change you could not verify; list it in the pull request as a
suggestion instead.

Also bump pinned versions that have fallen behind: GitHub Actions major
versions, the uv image tag in `Dockerfile`, and the hook revisions in
`.pre-commit-config.yaml`.

### 5. Report

If you changed anything, update the "Last scout" section below and open one
pull request. For each change give the source link and say what you ran to
verify it. If nothing needed to change, stop without opening a pull request or
an issue.

## Last scout

- 2026-11-14: manual review. Moved instructions to `AGENTS.md`, added hooks,
  permissions and the Claude workflow, removed the MCP config and the docs
  snapshot workflow.
