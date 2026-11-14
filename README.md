# Claude-First Python Template

A GitHub template for Python projects developed with Claude Code and other coding agents.

## What you get

- **Agent instructions**: a short `AGENTS.md` that any coding agent can read, imported by `CLAUDE.md`
- **Claude Code config**: permissions, hooks, skills, one subagent and path-scoped rules in `.claude/`
- **Enforced verification**: a Stop hook runs `make ci` before Claude finishes a turn that changed code
- **Cloud sessions**: a SessionStart hook installs dependencies in Claude Code on the web
- **Claude in GitHub**: `@claude` mentions and opt-in pull request review
- **Python tooling**: Python 3.12+, uv, ruff, pyright, pytest with coverage
- **Docker**: multi-stage build from `uv.lock`
- **CI**: lint, typecheck, test, package build, Docker build, and PR previews on GitHub Pages

## Quick start

1. Click **Use this template** on GitHub and clone your new repository.
2. Rename the project:

   ```bash
   make init NAME=my-new-project
   ```

   This replaces `my-project` / `my_project` everywhere, renames `src/my_project/` and refreshes `uv.lock`. Run `python3 scripts/init_project.py --help` for the author, email, GitHub user and description options.
3. Install and check:

   ```bash
   make install-dev
   make ci
   make verify
   ```

4. Start working:

   ```bash
   claude
   ```

uv is required: `curl -LsSf https://astral.sh/uv/install.sh | sh`.

## Commands

```bash
make install-dev   # Install runtime and dev dependencies (uv sync)
make ci            # Lint, format check, typecheck, tests with coverage
make verify        # Imports, tests, smoke tests, real CLI run
make test          # Tests only
make format        # Format with ruff
make hooks         # Install pre-commit git hooks
make docker-build  # Build the production image
make build-site    # Build static site artifacts for PR previews
make help          # Everything else
```

Tools are installed in `.venv`. Run them through `make` or `uv run`, for example `uv run pytest tests/test_core.py -x` or `uv run my-project info`.

## Project structure

```
.
├── AGENTS.md                  # Instructions for any coding agent
├── CLAUDE.md                  # Imports AGENTS.md, adds Claude Code specifics
├── .claude/
│   ├── settings.json          # Permissions and hooks
│   ├── hooks/                 # session-start.sh, format.sh, stop-check.sh
│   ├── rules/                 # Path-scoped rules (python-style, testing, docker)
│   ├── skills/                # /tdd, /fix-issue, /verify
│   └── agents/                # test-writer
├── .github/workflows/
│   ├── test.yml               # CI
│   ├── claude.yml             # @claude mentions and PR review
│   └── pages-preview.yml      # GitHub Pages deploy and PR previews
├── docs/claude/prompts/       # Prompts for scheduled sessions
├── scripts/init_project.py    # One-time rename
├── src/my_project/            # Package: cli, config, core, models
├── tests/                     # Unit and smoke tests
├── Dockerfile, docker-compose.yml
├── Makefile
└── pyproject.toml
```

## How the Claude setup works

### Instructions

`AGENTS.md` holds the project instructions: commands, how to verify a change, conventions and gotchas. `CLAUDE.md` imports it with `@AGENTS.md` and adds a few lines that only apply to Claude Code. Other agents that read `AGENTS.md` get the same instructions.

Both files are loaded on every task, so keep them short. Add a line when you have corrected the same thing twice, and delete lines that the code already makes obvious. Instructions that apply to one part of the tree go in `.claude/rules/` with a `paths:` frontmatter, where they load only when matching files are read.

### Permissions

`.claude/settings.json` allows `make`, `uv run`, `uv sync`, `uv lock` and read-only `git` and `gh` commands without a prompt, and denies reading `.env`. Personal overrides go in `.claude/settings.local.json`, which is git-ignored.

### Hooks

| Hook | Script | What it does |
|------|--------|--------------|
| SessionStart | `.claude/hooks/session-start.sh` | In cloud sessions, runs `uv sync` when `pyproject.toml` or `uv.lock` changed. Does nothing locally. |
| PostToolUse (Edit, Write) | `.claude/hooks/format.sh` | Formats the edited Python file with ruff. |
| Stop | `.claude/hooks/stop-check.sh` | If Python files, `pyproject.toml` or `uv.lock` have uncommitted changes, runs `make ci`. On failure Claude gets the output and keeps working. |

The Stop hook blocks once per turn. If `make ci` still fails after Claude's second attempt, Claude stops and reports the failure.

### Skills and agents

- `/tdd <description>`: red, green, refactor, then run the real code path
- `/fix-issue <number>`: reproduce, fix, verify, open a pull request
- `/verify`: `make ci`, `make verify`, then the changed code path. Claude can also invoke this itself.
- `test-writer` agent: writes tests for existing code and runs them

For code review and security review use Claude Code's built-in `/code-review` and `/security-review`.

### Code intelligence (optional)

The pyright language server plugin lets Claude jump to definitions and find references instead of searching. It is not enabled by the template. To use it locally, put `pyright-langserver` on your PATH and install the plugin inside Claude Code:

```bash
uv tool install pyright
```

```
/plugin install pyright-lsp@claude-plugins-official
```

### MCP servers

None are configured: this template's verification runs through the CLI, and every connected server adds to the context of every session. If your project needs one, add it with `claude mcp add --scope project ...`, which writes a `.mcp.json` at the repository root.

### Claude in GitHub

`.github/workflows/claude.yml` has two jobs:

- **Mentions**: write `@claude` in an issue, pull request comment or review comment and Claude responds, with the project installed so it can run `make ci`.
- **Review**: Claude reviews each pull request. This is off until you add the repository variable `CLAUDE_REVIEW` with the value `true`.

Both need one repository secret: `ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`. Running `/install-github-app` inside Claude Code sets this up.

### Keeping the template current

`docs/claude/prompts/template-scout.md` is a prompt for a scheduled Claude Code session. It reads the current Claude Code docs and changelog, compares them with this repository and opens one pull request with verified changes, or does nothing. Schedule it monthly if you maintain a fork of this template.

## Verification

Code is not done until it has been run.

1. Unit tests are necessary but not sufficient: they prove the code satisfies the tests.
2. `tests/test_smoke.py` runs the installed CLI as a subprocess.
3. `make verify` runs imports, tests, smoke tests and the CLI.
4. The Stop hook makes `make ci` a requirement, not a suggestion.

See "Verify what you change" in `AGENTS.md` for what to run for each kind of change.

## Docker

```bash
docker compose run --rm test    # Tests in a container
docker compose run --rm dev     # Development shell
make docker-build               # Production image
```

Images install from `uv.lock` with a pinned uv version, so they match local installs.

## PR previews

Every pull request from a branch in this repository gets a preview URL on GitHub Pages. This works for any static artifact your project produces: documentation, visualizations, reports.

### Setup (one-time)

1. Go to **Settings → Pages** in your GitHub repository
2. Set **Source** to "Deploy from a branch"
3. Set **Branch** to `gh-pages` and folder to `/ (root)`

The `gh-pages` branch is created by the first deploy.

### How it works

- Push to `main` deploys to the site root
- A pull request deploys to `/pr-{number}/` and gets a comment with the URL
- Closing or merging the pull request removes `/pr-{number}/`

### Customizing the build

The workflow runs `make build-site`, which by default writes a placeholder page to `site/`. Replace the body of that target with your project's build:

```makefile
build-site:
	uv run python -m my_project.export --output $(SITE_DIR)
```

The only contract is that output goes into `$(SITE_DIR)`.

## After creating your repository

- [ ] `make init NAME=...`, then delete `scripts/init_project.py` and the `init` Makefile target
- [ ] Fill in the remaining `TODO` fields in `pyproject.toml`
- [ ] Rewrite the first lines of `AGENTS.md` to describe your project
- [ ] Choose a license. The template is GPL-3.0-or-later; change `LICENSE` and `pyproject.toml` if you need another.
- [ ] Add the Claude secret if you want `@claude` in GitHub, and `CODECOV_TOKEN` if you use Codecov
- [ ] Replace the example code in `src/` and `tests/`
- [ ] Update this README

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
