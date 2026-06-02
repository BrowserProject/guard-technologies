#!/usr/bin/env python3
"""Validate the consolidated guard-technologies corpus.

Each technology record carries both the webappanalyzer fingerprint/basic fields
and the guard.ch enrichment layer; this validator covers the whole repository.

Checks, per file:
  - valid JSON, no duplicate keys
  - technologies/<letter>.json: keys sorted alphabetically (case-insensitive),
    every key starts with <letter> (or non-alpha keys live in _.json), and each
    record validates against the `technology` definition in schema.json
  - categories.json: keys are integers, each record validates against the
    `category` definition in schema.json
  - groups.json: keys are integers, each record validates against the `group`
    definition in schema.json

Referential integrity:
  - every `icon` referenced by a technology exists in src/images/icons/
  - every category id in a technology's `cats` exists in categories.json
  - every group id in a category's `groups` exists in groups.json

Run from the repo root:  python3 scripts/validate.py
Requires: jsonschema  (pip install jsonschema)
"""
import json
import pathlib
import string
import sys
from typing import Any

from jsonschema import Draft202012Validator

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
TECH_DIR = SRC / "technologies"
CATS_FILE = SRC / "categories.json"
GROUPS_FILE = SRC / "groups.json"
ICONS_DIR = SRC / "images" / "icons"
SCHEMA_FILE = ROOT / "schema.json"

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def no_duplicates(pairs: list[tuple[str, Any]]) -> dict:
    seen: dict = {}
    for k, v in pairs:
        if k in seen:
            raise ValueError(f"duplicate key '{k}'")
        seen[k] = v
    return seen


def load(path: pathlib.Path) -> dict:
    with path.open(encoding="utf8") as f:
        return json.load(f, object_pairs_hook=no_duplicates)


def main() -> int:
    schema = json.loads(SCHEMA_FILE.read_text(encoding="utf8"))
    tech_validator = Draft202012Validator({**schema, "$ref": "#/$defs/technology"})
    cat_validator = Draft202012Validator({**schema, "$ref": "#/$defs/category"})
    group_validator = Draft202012Validator({**schema, "$ref": "#/$defs/group"})

    icon_files = {p.name for p in ICONS_DIR.iterdir()} if ICONS_DIR.is_dir() else set()
    referenced_cats: set[int] = set()
    referenced_groups: set[int] = set()
    category_ids: set[int] = set()
    group_ids: set[int] = set()

    letters = list(string.ascii_lowercase) + ["_"]
    total_techs = 0
    for letter in letters:
        path = TECH_DIR / f"{letter}.json"
        if not path.exists():
            continue
        try:
            data = load(path)
        except ValueError as e:
            err(f"{path.name}: {e}")
            continue

        keys = list(data.keys())
        ordered = sorted(keys, key=lambda x: (x.lower(), x))
        if keys != ordered:
            for a, b in zip(keys, ordered):
                if a != b:
                    err(f"{path.name}: not alphabetical (found '{a}', expected '{b}')")
                    break

        for name, rec in data.items():
            first = name[0].lower()
            expected = first if first in string.ascii_lowercase else "_"
            if expected != letter:
                err(f"{path.name}: '{name}' belongs in {expected}.json")
            for v in tech_validator.iter_errors(rec):
                err(f"{path.name}: '{name}': {v.message}")
            icon = rec.get("icon")
            if icon and icon not in icon_files:
                err(f"{path.name}: '{name}': icon '{icon}' not found in src/images/icons/")
            referenced_cats.update(int(c) for c in rec.get("cats", []))
        total_techs += len(data)

    if not CATS_FILE.exists():
        err("src/categories.json is missing")
    else:
        try:
            cats = load(CATS_FILE)
            for cid, rec in cats.items():
                if not cid.lstrip("-").isdigit():
                    err(f"categories.json: key '{cid}' is not an integer id")
                else:
                    category_ids.add(int(cid))
                for v in cat_validator.iter_errors(rec):
                    err(f"categories.json: id {cid}: {v.message}")
                referenced_groups.update(int(g) for g in rec.get("groups", []))
            print(f"categories: {len(cats)}")
        except ValueError as e:
            err(f"categories.json: {e}")

    if not GROUPS_FILE.exists():
        err("src/groups.json is missing")
    else:
        try:
            groups = load(GROUPS_FILE)
            for gid, rec in groups.items():
                if not gid.lstrip("-").isdigit():
                    err(f"groups.json: key '{gid}' is not an integer id")
                else:
                    group_ids.add(int(gid))
                for v in group_validator.iter_errors(rec):
                    err(f"groups.json: id {gid}: {v.message}")
            print(f"groups: {len(groups)}")
        except ValueError as e:
            err(f"groups.json: {e}")

    for cid in sorted(referenced_cats - category_ids):
        err(f"technologies reference category id {cid} missing from categories.json")
    for gid in sorted(referenced_groups - group_ids):
        err(f"categories reference group id {gid} missing from groups.json")

    print(f"technologies: {total_techs}")
    print(f"icons: {len(icon_files)}")

    if errors:
        print(f"\nFAILED with {len(errors)} error(s):", file=sys.stderr)
        for e in errors[:200]:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
