---
name: verify
description: Verify that a change actually works by running it. Use before reporting a code change as done.
---

# Verify

Run these and read the output. Do not report a step as passing unless you saw it pass.

```bash
make ci       # lint, format check, typecheck, tests with coverage
make verify   # imports, tests, smoke tests, real CLI invocations
```

Then run the specific code path you changed, with real input, and check the output is correct and free of warnings. `make verify` only covers `info` and `run`; a new command or option needs its own invocation, for example `uv run my-project --debug run --name test`.

If you changed something other than Python code, verify that thing instead: see "Verify what you change" in `AGENTS.md`.

## Not verified

- Tests were written but the code was not run outside them
- The code was read but not run
- A command exited 0 but its output was not checked

Report what you ran and what you saw. If a step failed or was skipped, say so.
