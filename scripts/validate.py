#!/usr/bin/env python3
"""Validate the guard-technologies enrichment corpus.

Checks, per file:
  - valid JSON, no duplicate keys
  - technologies/<letter>.json: keys sorted alphabetically (case-insensitive),
    every key starts with <letter> (or non-alpha keys live in _.json), and each
    record validates against the `technology` definition in schema.json
  - categories.json: keys are integers, each record validates against the
    `category` definition in schema.json

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
        total_techs += len(data)

    if not CATS_FILE.exists():
        err("src/categories.json is missing")
    else:
        try:
            cats = load(CATS_FILE)
            for cid, rec in cats.items():
                if not cid.lstrip("-").isdigit():
                    err(f"categories.json: key '{cid}' is not an integer id")
                for v in cat_validator.iter_errors(rec):
                    err(f"categories.json: id {cid}: {v.message}")
            print(f"categories: {len(cats)}")
        except ValueError as e:
            err(f"categories.json: {e}")

    print(f"technologies: {total_techs}")

    if errors:
        print(f"\nFAILED with {len(errors)} error(s):", file=sys.stderr)
        for e in errors[:200]:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
