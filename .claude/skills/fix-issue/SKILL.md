---
name: fix-issue
description: Fix a GitHub issue from investigation to pull request
argument-hint: "[issue-number]"
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS.

1. **Understand**: `gh issue view $ARGUMENTS --comments`. If the issue is ambiguous, ask before writing code.
2. **Reproduce**: write a failing test that shows the bug, or run the command that triggers it. Do not fix what you have not reproduced.
3. **Fix**: address the root cause and follow the patterns already in the code.
4. **Verify**: `make ci`, then `make verify`, then run the exact scenario from the issue and confirm the output is now correct.
5. **Commit**: on a branch, staging files by path, with a Conventional Commit message that references the issue (`fix: ... (#$ARGUMENTS)`).
6. **Pull request**: push and `gh pr create`. In the description say what caused the bug, what changed and what you ran to verify it. Put any long generated detail inside a `<details>` block so the summary stays readable.

Stop and report instead of opening a pull request if step 2 or step 4 did not succeed.
