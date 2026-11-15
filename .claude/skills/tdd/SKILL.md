---
name: tdd
description: Test-driven development workflow. Use when implementing a new feature or fixing a bug test-first.
argument-hint: "[feature or bug description]"
---

# Test-driven development

Task: $ARGUMENTS

1. **Red**: write a test that describes the behavior. Run it with `uv run pytest tests/test_<module>.py -x` and confirm it fails for the expected reason. A test that fails on an import error has not shown anything yet.
2. **Green**: write the smallest change that makes it pass. Run the same command.
3. **Refactor**: clean up with the tests still passing.
4. **Verify**: run `make ci`, then run the real code path outside the tests (`uv run my-project ...` or `make verify`) and check the output.

A unit test proves the code satisfies the test, not that the feature works. Step 4 is not optional.
