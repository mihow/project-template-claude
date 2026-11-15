#!/bin/bash
# Stop hook: when Python or project config has uncommitted changes or commits
# that are not on the upstream branch yet, run `make ci` before Claude is
# allowed to finish. Exit code 2 blocks the stop and
# sends stderr back to Claude as the reason.
set -uo pipefail

active=$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("stop_hook_active", False))' 2>/dev/null)
# Already blocked once this turn: let Claude stop rather than loop.
if [ "$active" = "True" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Files with uncommitted changes (untracked files listed one by one), plus
# files changed in commits that are not on the upstream branch yet.
changed=$(
  git status --porcelain --untracked-files=all 2>/dev/null
  git diff --name-only '@{upstream}...HEAD' 2>/dev/null
)

# Nothing relevant changed (a question, a docs edit): skip the check.
# The optional quote covers paths that git quotes, such as ones with spaces.
if ! echo "$changed" | grep -qE '(\.py|pyproject\.toml|uv\.lock)"?$'; then
  exit 0
fi

if ! output=$(make ci 2>&1); then
  {
    echo "make ci failed. Fix the failures below before finishing."
    echo "$output" | tail -n 40
  } >&2
  exit 2
fi
exit 0
