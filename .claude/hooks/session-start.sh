#!/bin/bash
# SessionStart hook: install dependencies in Claude Code cloud sessions so that
# tests and linters work from the first message. Local sessions are left alone.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

if ! command -v uv >/dev/null; then
  python3 -m pip install --quiet uv
fi

# Reinstall only when a file that decides what gets installed has changed.
# The hash file lives in .venv, so it disappears together with the packages.
hashes=.venv/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  uv sync
  sha256sum .claude/hooks/session-start.sh pyproject.toml uv.lock > "$hashes" || rm -f "$hashes"
fi
