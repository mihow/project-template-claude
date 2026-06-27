# Template Audit — 2026-06-26

This document is a maintainer-facing audit of the public "Claude-first Python project template" repository.
It is not intended for template consumers; it records what is working well (and must not regress) alongside
a prioritized fix list for known gaps and correctness issues.

**Scope:** This audit accompanies the addition of the `sonnet-fleet` multi-agent harness (added in the same
branch) and captures pre-existing issues discovered during that review. Items introduced by the sonnet-fleet
branch itself are excluded from the issue table.

---

## Summary

The template is strong on verification culture and modern Python tooling: the verification-first discipline
is reinforced across four separate surfaces, and the current toolchain choices (uv, ruff, pyright,
hatchling) reflect current best practice. The main gaps are a missing multi-agent orchestration harness
(now being addressed by the sonnet-fleet skill in this branch), a handful of correctness bugs that will
silently break any project that follows the documented rename procedure (license mismatch, hardcoded
package name in three skills, hardcoded coverage path in the Makefile), and a few pieces of shipped clutter
that inflate every clone without adding value.

---

## Strengths to preserve

1. Verification-first culture reinforced in four places: `CLAUDE.md`, `rules/verification.md`, `skills/verify`, and `skills/tdd`.
2. Correct skill-invocation gating via `disable-model-invocation` on side-effectful skills (`fix-issue`, `verify`).
3. Path-scoped rules (`paths:` frontmatter) keep irrelevant rules out of context on unrelated files.
4. Concrete model-routing guidance: Sonnet for research, Haiku for implementation.
5. Opinionated current toolchain: uv, ruff, pyright, hatchling — all active defaults as of 2026.
6. Automated docs-freshness check (`.github/workflows/check-docs.yml`) hashes official Claude Code docs weekly and files issues on change.
7. Polished PR-preview workflow (`pages-preview.yml`) with idempotent comments and concurrency handling.
8. Security-reviewer agent correctly restricted to read-only tools.
9. Verification levels tiered by real cost: imports -> unit -> smoke -> CLI -> lint/type.
10. `NEXT_SESSION_PROMPT.md` demonstrates the session-continuity pattern by example in the repo itself.

---

## Issues and recommended fixes

| # | Issue | Location | Severity | Fix | Type |
|---|-------|----------|----------|-----|------|
| 1 | License mismatch: `pyproject.toml` declares MIT (both `license` field and classifier) but `LICENSE` is GPL v3. Any published package would carry incorrect SPDX metadata. | `pyproject.toml` lines 6+, `LICENSE` | High | Decide the real license and make both files agree. **Requires a maintainer decision — do not auto-change.** | Correctness |
| 2 | Three skills hardcode the package name `my_project` / `my-project` (`verify/SKILL.md`, `tdd/SKILL.md`, `fix-issue/SKILL.md`), so they silently break for any project that follows the documented rename procedure. | `.claude/skills/verify/SKILL.md`, `tdd/SKILL.md`, `fix-issue/SKILL.md` | Medium | Parameterize via `$ARGUMENTS` or a documented `{{package_name}}` placeholder; alternatively, add an explicit note to the rename checklist. | Correctness |
| 3 | `Makefile` `test-cov` and `test-ci` targets hardcode `--cov=my_project`; after rename, coverage silently reports 0% on the actual package. | `Makefile` (test-cov, test-ci targets) | Medium | Derive the package name from the directory under `src/`, or add this edit to the rename checklist alongside the other `my_project` replacements. | Correctness |
| 4 | `configs/skills/README.md` documents an old `skill.yaml` format that does not match the actual `SKILL.md` frontmatter convention used by every skill in this repo. A user following the README will write a broken skill. | `configs/skills/README.md` | Medium | Rewrite to document the `SKILL.md` frontmatter format (name, description, tools, trigger, disable-model-invocation, paths) with a minimal working example. | Docs |
| 5 | `configs/plugins/README.md` contains fictional tooling blocks (a non-existent Claude.vim plugin, unrelated "CTO Sidekick" aliases) that have no connection to this template or its toolchain. | `configs/plugins/README.md` | Low | Remove the fictional blocks; keep only accurate, usable content. | Clutter |
| 6 | `NEXT_SESSION_PROMPT.md` ships stale author session content ("CI Failures to Fix... fixed in prior sessions") in every clone. A new consumer opens this file and finds someone else's resolved tasks. | `NEXT_SESSION_PROMPT.md` | Low | Replace with a blank template with header comments, or add it to `.gitignore` so each consumer's version stays local. | Clutter |
| 7 | Doc snapshots under `.claude/docs/snapshots/` are roughly 3,193 lines of raw HTML-to-markdown with full site chrome, carried in every clone (~200 KB of low-signal content). The hashes in `check-docs.yml` are what drive the freshness check; the raw content is not needed. | `.claude/docs/snapshots/` | Low | Keep only the hash files for change-detection, or strip site chrome before committing. Consider a `.gitignore` entry and a `make fetch-docs` target to populate them locally on demand. | Clutter |
| 8 | `settings.json` has no `permissions.allow` list and no hooks; every session starts at maximum prompt friction for routine read-only and build commands. | `.claude/settings.json` | Medium | Add a `permissions.allow` list covering routine read-only Bash operations and standard build commands (`make`, `uv`, `ruff`, `pyright`). Consider a `PostToolUse` lint hook to surface ruff/pyright feedback automatically. | Enhancement |
| 9 | No multi-agent orchestration harness existed before this branch. There is no skill or documented pattern for fanning work out across multiple Claude instances. | (absent) | Medium | Addressed by the new `sonnet-fleet` skill in this same branch. | Enhancement |
| 10 | Committed coverage or cache artifacts may be present in the working tree (`htmlcov/`, `.coverage`, `.pytest_cache/`, `.ruff_cache/`). | `.gitignore`, working tree | Low | Confirm all of these are listed in `.gitignore` and are untracked. Remove from git tracking if any were accidentally committed (`git rm -r --cached <path>`). | Clutter |

---

## Suggested order of work

1. **License decision (item 1):** Resolve the MIT-vs-GPL mismatch first. This is the only item that requires a human decision before anything else can be done correctly; it also has legal implications if the template is published or forked publicly. Make the call, then update both `pyproject.toml` and `LICENSE` atomically.

2. **Package-name parameterization (items 2, 3):** Once the license is settled, fix the `my_project` hardcoding in the three skills and the Makefile coverage targets. These are safe automated edits and unblock consumers who follow the rename procedure.

3. **Docs correctness (item 4):** Rewrite `configs/skills/README.md` to match the actual `SKILL.md` frontmatter format. This is a documentation-only edit with no risk.

4. **Clutter removal (items 5, 6, 7, 10):** Remove the fictional plugin content, blank out `NEXT_SESSION_PROMPT.md`, decide on a snapshot strategy, and audit `.gitignore` for cache paths. These are low-risk cleanups that reduce clone weight and confusion for new users.

5. **Enhancement track (items 8, 9):** Add the `permissions.allow` list and hook configuration to `settings.json`, and validate the new `sonnet-fleet` skill against the existing skill conventions. These can proceed in parallel with the clutter cleanup once the correctness issues are addressed.

> Items 2, 3, 4, 5, 6, 7, 10 are safe automated edits. Item 1 (license) and item 8 (permissions policy) require a maintainer decision before implementation.
