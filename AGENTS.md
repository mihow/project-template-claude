# Project instructions

A Claude-first Python project template: `src/my_project/` (CLI, config, core, models), tests in `tests/`.
These instructions are for any coding agent. Claude Code reads them through `CLAUDE.md`.

## Commands

```bash
make install-dev   # uv sync (runtime + dev dependencies)
make ci            # lint, format check, typecheck, tests with coverage
make verify        # imports, tests, smoke tests, real CLI run
uv run pytest tests/test_core.py -x      # one test file
uv run my-project info                   # run the CLI
make help          # everything else
```

Tools live in `.venv` and are not on PATH. Use `make` or `uv run`, never bare `pytest`, `ruff` or `my-project`.

## Verify what you change

Work is not done until you have run the thing you changed and read its output. Passing tests alone do not count.

- Python code: `make ci`, then run the code path you changed (`make verify` covers the CLI)
- A GitHub workflow: push, then read the run's output
- Pre-commit config: `uv run pre-commit run --all-files`
- Dockerfile or compose: `docker compose build`
- Dependencies: `uv lock && make install-dev && make ci`

## Conventions

- Type hints use built-ins and `X | None`. For typing-only names use the namespace (`typing.Sequence`), not `from typing import ...`.
- Expected failures return a `Result` (see `src/my_project/models.py`); unexpected ones raise.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Small commits.
- Stage files by path (`git add src/my_project/core.py`). Never `git add -A` or `git add .`.
- Fix the root cause. If a fix feels like a patch over a symptom, say so before writing it.
- Docs and PR text: factual, no "comprehensive", "robust" or "production-ready".

## Gotchas

- Settings are cached. Tests that change env vars must call `get_settings.cache_clear()`.
- Dev dependencies are in `[dependency-groups]`, so plain `uv sync` installs them. `uv sync --no-dev` leaves them out.
- Never set `UV_SYSTEM_PYTHON=1` with `uv sync`: it makes `uv run` bypass the `.venv` that `uv sync` created.
- The type checker is pyright, not mypy. `try/except ImportError` fallbacks need no `type: ignore`.
- Coverage must stay at or above 80% (`pyproject.toml`), or `make ci` fails.
- A CI job that fails seconds after install usually means a tool binary is not on PATH.
- `gh run view --log-failed` can print nothing. Use `gh api repos/{owner}/{repo}/actions/jobs/{job_id}/logs`.

Add a line here when you have had to correct the same thing twice. Keep this file short: every line is read on every task.
