@AGENTS.md

## Claude Code

- Hooks in `.claude/settings.json` do two things for you. Python files are formatted with ruff after each edit, so don't format by hand. When you finish a turn with Python or config changes pending, `make ci` runs and its failures come back to you to fix.
- Project skills: `/tdd`, `/fix-issue <number>`, `/verify`. For review use the built-in `/code-review` and `/security-review`.
- Path-scoped rules are in `.claude/rules/`. Put anything that applies to one part of the tree there, not in `AGENTS.md`.
