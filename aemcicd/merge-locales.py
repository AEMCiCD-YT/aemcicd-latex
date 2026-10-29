#!/usr/bin/env python3
"""Adds the AEMCiCD Spanish strings (aemcicd/locales/es.json) to services/web/locales/es.json.

Upstream Overleaf leaves most of es.json untranslated and edits it on every release, so our
strings live in their own file. Run after merging an upstream release (resolve a conflict in
services/web/locales/es.json by taking upstream's version first):

    python3 aemcicd/merge-locales.py

Only keys that still exist in en.json are added; upstream translations are never overwritten.
It prints the English keys that are still missing, to translate into aemcicd/locales/es.json and
check with aemcicd/check-translations.py.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "services" / "web" / "locales"
OVERLAY = ROOT / "aemcicd" / "locales" / "es.json"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    en = load(LOCALES / "en.json")
    es = load(LOCALES / "es.json")
    ours = load(OVERLAY)
    added = {key: value for key, value in ours.items() if key in en and key not in es}
    merged = dict(sorted({**es, **added}.items()))
    (LOCALES / "es.json").write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    missing = [key for key in en if key not in merged]
    print(f"added {len(added)} strings; es.json has {len(merged)} of {len(en)}")
    if missing:
        print("still missing:\n  " + "\n  ".join(missing))


if __name__ == "__main__":
    main()
