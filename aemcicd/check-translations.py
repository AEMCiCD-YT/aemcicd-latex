#!/usr/bin/env python3
"""Checks a Spanish translation against the English source: same keys, and every placeholder
({{var}}, __var__), numbered tag (<0>…</0>) and HTML tag preserved.

    python3 aemcicd/check-translations.py <en.json> <es.json>
"""
import json
import re
import sys
from collections import Counter

TOKENS = re.compile(r"\{\{\s*[\w.]+\s*\}\}|__\w+__|</?\d+>|</?[a-zA-Z][^<>]*?/?>")


def tokens(text):
    return Counter(re.sub(r"\s+", "", t) for t in TOKENS.findall(text))


def main(en_path, es_path):
    en = json.load(open(en_path, encoding="utf-8"))
    es = json.load(open(es_path, encoding="utf-8"))
    problems = []
    for key in en:
        if key not in es:
            problems.append(f"{key}: missing")
        elif not isinstance(es[key], str) or not es[key].strip():
            problems.append(f"{key}: empty")
        elif tokens(en[key]) != tokens(es[key]):
            problems.append(f"{key}: tokens {sorted(tokens(en[key]).elements())} != {sorted(tokens(es[key]).elements())}")
    problems += [f"{key}: not in English source" for key in es if key not in en]
    print("\n".join(problems) if problems else f"OK: {len(es)} strings")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
