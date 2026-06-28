#!/usr/bin/env python3
"""Quantify and extract agent behavior from Claude Code session logs.

Claude Code stores each session as a JSONL transcript under
~/.claude/projects/<encoded-project-path>/<session-id>.jsonl, where every assistant
entry is tagged with the model that produced it. This script computes cheap,
deterministic per-(session, model) metrics and writes a readable per-session extract of
one model's turns, so you can study how an agent actually behaved — and compare two
models within the same session to separate the model from your own instructions.

It is the "external-oracle" first pass of a behavior analysis: measure the things that do
not need a judgment call (tool counts, message lengths, how often tests were run, how
often a completion was claimed, how often a tool errored) before asking an LLM to
interpret anything. Standard library only; no network.

Usage:
  python session_metrics.py --logs '~/.claude/projects/**/*.jsonl' --model claude-opus \\
      --out ./session-analysis
  python session_metrics.py --logs ./one-session.jsonl            # all models, metrics only

Notes:
  - --model is a substring matched against the assistant entry's model id; the readable
    extract is written only for matching turns. Omit it to get metrics for every model.
  - Privacy: transcripts contain whatever you worked on (file paths, hostnames, tokens).
    Treat the output as sensitive and scrub before sharing. See the skill's SKILL.md.
"""
import argparse
import collections
import contextlib
import glob
import json
import re
import statistics
from dataclasses import dataclass, field
from pathlib import Path

# Heuristics. Tune these to your stack; they only affect the convenience counters.
TEST_RE = re.compile(r"\b(pytest|ruff|pyright|mypy|tsc|npm (run )?test|yarn test|jest|"
                     r"vitest|make (test|verify|check|ci)|cargo test|go test|eslint)\b", re.I)
DONE_RE = re.compile(r"\b(done|complete[d]?|verified|all (tests )?pass|looks good|"
                     r"should (pass|work|be fine)|finished|good to go|ready to merge|lgtm)\b", re.I)
HEDGE_RE = re.compile(r"\b(as you (asked|requested)|to be (clear|fair)|i should note|"
                      r"caveat|for transparency)\b", re.I)


@dataclass
class Acc:
    """Per-(session, model) accumulator. Typed so the counters stay pyright-clean."""
    turns: int = 0
    tool_calls: int = 0
    tool_names: collections.Counter = field(default_factory=collections.Counter)
    text_lens: list[int] = field(default_factory=list)
    test_cmds: int = 0
    done_phrases: int = 0
    hedge_phrases: int = 0
    tool_errors: int = 0
    with_thinking: int = 0


def blocks(entry: dict) -> list:
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    return content if isinstance(content, list) else []


def text_of(entry: dict) -> str:
    return " ".join(b.get("text", "") for b in blocks(entry)
                    if isinstance(b, dict) and b.get("type") == "text").strip()


def short(s: str, n: int) -> str:
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[:n] + " …"


def load(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            with contextlib.suppress(Exception):
                rows.append(json.loads(line))
    return rows


def tool_errors_after(rows: list[dict], i: int) -> int:
    """Count error tool_results in the user entry immediately following turn i."""
    if i + 1 >= len(rows) or rows[i + 1].get("type") != "user":
        return 0
    return sum(1 for b in blocks(rows[i + 1])
               if isinstance(b, dict) and b.get("type") == "tool_result" and b.get("is_error"))


def tally(rows: list[dict]) -> dict:
    per_model: dict[str, Acc] = collections.defaultdict(Acc)
    for i, entry in enumerate(rows):
        model = (entry.get("message") or {}).get("model")
        if entry.get("type") != "assistant" or not model:
            continue
        bl = blocks(entry)
        txt = text_of(entry)
        tools = [b for b in bl if isinstance(b, dict) and b.get("type") == "tool_use"]
        m = per_model[model]
        m.turns += 1
        m.tool_calls += len(tools)
        m.tool_errors += tool_errors_after(rows, i)
        if any(isinstance(b, dict) and b.get("type") == "thinking" for b in bl):
            m.with_thinking += 1
        if txt:
            m.text_lens.append(len(txt))
        m.done_phrases += bool(DONE_RE.search(txt))
        m.hedge_phrases += bool(HEDGE_RE.search(txt))
        for t in tools:
            m.tool_names[t.get("name", "?")] += 1
            if t.get("name") == "Bash" and TEST_RE.search(json.dumps(t.get("input", {}))):
                m.test_cmds += 1
    return per_model


def preceding_prompt(rows: list[dict], i: int) -> str:
    for j in range(i - 1, max(-1, i - 4), -1):
        pt = text_of(rows[j])
        if rows[j].get("type") == "user" and pt and not pt.startswith("<"):
            return pt
    return ""


def extract_turns(rows: list[dict], model_filter: str) -> list[str]:
    lines: list[str] = []
    matched = 0
    for i, entry in enumerate(rows):
        model = (entry.get("message") or {}).get("model") or ""
        if entry.get("type") != "assistant" or model_filter not in model:
            continue
        matched += 1
        tools = [b for b in blocks(entry) if isinstance(b, dict) and b.get("type") == "tool_use"]
        tnames = ", ".join(f"{t.get('name')}({short(json.dumps(t.get('input', {})), 80)})" for t in tools)
        lines.append(f"## Turn {matched} (entry {i})")
        prev = preceding_prompt(rows, i)
        if prev:
            lines.append(f"_responding to:_ {short(prev, 240)}")
        if text_of(entry):
            lines.append(f"_text:_ {short(text_of(entry), 1600)}")
        if tnames:
            lines.append(f"_tools:_ {short(tnames, 600)}")
        lines.append("")
    return lines


def row_for(name: str, model: str, m: Acc) -> dict:
    return {
        "session": name, "model": model, "turns": m.turns, "tool_calls": m.tool_calls,
        "tools_per_turn": round(m.tool_calls / m.turns, 2),
        "median_text_len": int(statistics.median(m.text_lens)) if m.text_lens else 0,
        "test_cmds": m.test_cmds, "done_phrases": m.done_phrases,
        "hedge_phrases": m.hedge_phrases, "tool_errors": m.tool_errors,
        "with_thinking": m.with_thinking,
        "top_tools": ", ".join(f"{n}:{c}" for n, c in m.tool_names.most_common(5)),
    }


def analyze(path: Path, model_filter: str, out_dir: Path | None) -> list[dict]:
    name = path.stem
    rows = load(path)
    per_model = tally(rows)
    if out_dir and model_filter:
        lines = extract_turns(rows, model_filter)
        if lines:
            out_dir.mkdir(parents=True, exist_ok=True)
            header = [f"# Session extract: {name}", f"source: {path}", f"model filter: {model_filter}", ""]
            (out_dir / f"{name}.extract.md").write_text("\n".join(header + lines), encoding="utf-8")
    return [row_for(name, model, m) for model, m in
            sorted(per_model.items(), key=lambda kv: -kv[1].turns) if m.turns]


def render(rows: list[dict]) -> str:
    hdr = ["session", "model", "turns", "tool_calls", "tools_per_turn", "median_text_len",
           "test_cmds", "done_phrases", "hedge_phrases", "tool_errors", "with_thinking"]
    lines = ["| " + " | ".join(hdr) + " |", "|" + "---|" * len(hdr)]
    lines += ["| " + " | ".join(str(r[h]) for h in hdr) + " |" for r in rows]
    lines += ["", "Top tools per (session, model):"]
    lines += [f"- {r['session']} / {r['model']}: {r['top_tools']}" for r in rows]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description="Quantify agent behavior from Claude Code session logs.")
    ap.add_argument("--logs", required=True, help="Path or glob to session .jsonl files (use quotes).")
    ap.add_argument("--model", default="", help="Substring of the model id to extract turns for.")
    ap.add_argument("--out", default="", help="Output directory for per-session extracts + metrics.")
    args = ap.parse_args()

    pattern = str(Path(args.logs).expanduser())
    paths = sorted(Path(p) for p in glob.glob(pattern, recursive=True))  # noqa: PTH207 (arbitrary user glob)
    if not paths:
        raise SystemExit(f"No files matched: {args.logs}")

    out_dir = Path(args.out).expanduser() if args.out else None
    rows = [r for p in paths for r in analyze(p, args.model, out_dir)]
    table = render(rows)
    print(table)
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "metrics.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
        (out_dir / "metrics.md").write_text(table, encoding="utf-8")
        print(f"\nWrote metrics + extracts to {out_dir}")


if __name__ == "__main__":
    main()
