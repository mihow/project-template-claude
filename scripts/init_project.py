#!/usr/bin/env python3
"""Rename this template to a new project.

Replaces the placeholder names (`my-project`, `my_project`, `My Project`) in
every tracked file, renames `src/my_project/`, and refreshes `uv.lock`.

Usage:
    python3 scripts/init_project.py my-new-project
    python3 scripts/init_project.py my-new-project --author "Ada" --email ada@example.org \
        --github-user ada --description "What it does"

Uses only the standard library, so it runs before any dependencies are installed.
Run it once, review `git diff`, then delete this script and the `init` Makefile target.
"""

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OLD_DIST = "my-project"
OLD_PACKAGE = "my_project"
OLD_TITLE = "My Project"
# Files that must keep the placeholder names or are regenerated.
SKIP = {"scripts/init_project.py", "uv.lock", "LICENSE"}


def tracked_files() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    return [ROOT / name for name in out.split("\0") if name and name not in SKIP]


def is_git_checkout() -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"], cwd=ROOT, capture_output=True, check=False
    )
    return result.returncode == 0


def replace_in_file(path: Path, replacements: list[tuple[str, str]]) -> bool:
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, FileNotFoundError):
        return False
    new = text
    for old, replacement in replacements:
        new = new.replace(old, replacement)
    if new == text:
        return False
    path.write_text(new, encoding="utf-8")
    return True


def apply_metadata(args: argparse.Namespace, package: str) -> None:
    """Fill in author, email, description and URLs.

    These are placeholders in package metadata only. Replacing them in every
    file would rewrite unrelated prose.
    """
    metadata: list[tuple[str, str]] = []
    if args.author:
        metadata.append(("Your Name", args.author))
    if args.email:
        metadata.append(("you@example.com", args.email))
    if args.description:
        metadata.append(("A Claude-first Python project", args.description))
    if metadata:
        for path in (ROOT / "pyproject.toml", ROOT / "src" / package / "__init__.py"):
            replace_in_file(path, metadata)
    if args.github_user:
        for path in (ROOT / "pyproject.toml", ROOT / "Dockerfile"):
            replace_in_file(path, [("yourusername", args.github_user)])


def main() -> int:
    parser = argparse.ArgumentParser(description="Rename this template to a new project.")
    parser.add_argument("name", help="new project name, e.g. my-new-project")
    parser.add_argument("--author", help="author name for pyproject.toml")
    parser.add_argument("--email", help="author email for pyproject.toml")
    parser.add_argument("--github-user", help="GitHub user or organisation for project URLs")
    parser.add_argument("--description", help="one-line project description")
    args = parser.parse_args()

    dist = re.sub(r"[_\s.]+", "-", args.name.strip()).lower()
    if not re.fullmatch(r"[a-z][a-z0-9]*(-[a-z0-9]+)*", dist):
        print(f"error: {args.name!r} is not a usable project name", file=sys.stderr)
        print("use lowercase letters, digits and hyphens, starting with a letter", file=sys.stderr)
        return 1
    package = dist.replace("-", "_")
    title = " ".join(word.capitalize() for word in dist.split("-"))

    if not (ROOT / "src" / OLD_PACKAGE).is_dir():
        print(
            f"error: src/{OLD_PACKAGE}/ not found; was the project already renamed?",
            file=sys.stderr,
        )
        return 1
    if dist == OLD_DIST:
        print("error: that is the template's placeholder name", file=sys.stderr)
        return 1

    if not is_git_checkout():
        print("error: not a git checkout; run `git init && git add .` first", file=sys.stderr)
        return 1

    # Move the directory first: if this fails, nothing has been rewritten yet.
    subprocess.run(["git", "mv", f"src/{OLD_PACKAGE}", f"src/{package}"], cwd=ROOT, check=True)

    names = [(OLD_PACKAGE, package), (OLD_DIST, dist), (OLD_TITLE, title)]
    changed = [p for p in tracked_files() if replace_in_file(p, names)]

    apply_metadata(args, package)

    print(f"Renamed to {dist} (package {package}); updated {len(changed)} files.")

    if shutil.which("uv"):
        subprocess.run(["uv", "lock"], cwd=ROOT, check=True)
        print("Refreshed uv.lock.")
    else:
        print("uv not found: run `uv lock` once it is installed.")

    print("\nNext steps:")
    print("  1. make install-dev && make ci && make verify")
    print("  2. grep -rn TODO pyproject.toml src/   # remaining fields to fill in")
    print(
        "  3. review `git diff`, then delete scripts/init_project.py and the `init` Makefile target"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
