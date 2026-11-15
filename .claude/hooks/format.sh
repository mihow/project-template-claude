#!/bin/bash
# PostToolUse hook (Edit|Write): format the edited Python file with ruff.
# Formatting only. Lint fixes are left to `make ci`, because auto-removing an
# import that the next edit is about to use gets in the way.
set -uo pipefail

file=$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))' 2>/dev/null)

case "$file" in
  *.py) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}"
uv run --quiet ruff format --quiet "$file" 2>/dev/null || true
exit 0
