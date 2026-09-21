#!/usr/bin/env python3
"""
Turn the raw scrapes into the two files the app fetches at runtime.

  public/data/questions.json  - every question, deduped, all 4 languages
  public/data/tests.json      - test templates, referencing question ids

Questions are stored once and referenced by id, so a question appearing in both
a 10- and a 20-question test isn't duplicated on the wire.

  python3 scripts/build_data.py
"""

import json
import os
import glob
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRAPES = os.path.join(ROOT, "scrapes")
OUT = os.path.join(ROOT, "public", "data")

LANGS = ("uzb", "uzc", "ru")


def basename(url):
    return (url or "").rsplit("/", 1)[-1].split("?")[0] or None


def norm_question(q):
    """Flatten a scraped question into the app's shape."""
    answers = [
        {
            "id": a["id"],
            "text": {l: (a.get("answer") or {}).get(l, "") for l in LANGS},
            "media": basename(a.get("media")),
        }
        for a in q.get("answers", [])
    ]
    return {
        "id": q["id"],
        "text": {l: (q.get("question") or {}).get(l, "") for l in LANGS},
        "media": basename(q.get("media")),
        "answerId": q.get("answerId"),
        "answers": answers,
        "sort": q.get("sort"),
    }


def main():
    questions = {}       # id -> question (newer scrape wins)
    tests = []

    # --- tests-20: the composed file, newest scrape, authoritative ---
    for path in sorted(glob.glob(os.path.join(SCRAPES, "tests-20", "*.json"))):
        data = json.load(open(path))
        for key, test in data.items():
            qids = []
            for q in test.get("questions", []):
                questions[q["id"]] = norm_question(q)   # overwrite: newest wins
                qids.append(q["id"])
            tests.append({
                "id": f"t20-{test['templateNumber']}",
                "size": 20,
                "number": test["templateNumber"],
                "questionIds": qids,
            })

    # --- tests-10: older, only fills questions the newer scrape lacks ---
    for path in sorted(glob.glob(os.path.join(SCRAPES, "tests-10", "*.json"))):
        m = re.search(r"solvetest-(\d+)-", os.path.basename(path))
        number = int(m.group(1)) if m else len(tests)
        body = json.loads(json.load(open(path))["body"])
        qids = []
        for q in body.get("questions", []):
            questions.setdefault(q["id"], norm_question(q))
            qids.append(q["id"])
        if qids:
            tests.append({
                "id": f"t10-{number}",
                "size": 10,
                "number": number,
                "questionIds": qids,
            })

    # The 10-question sets carry e-avtomaktab's internal URL ids (5..356, with
    # gaps). "Test #356" means nothing to a student, so renumber them 1..N for
    # display while keeping `id` tied to the source id so URLs stay stable and
    # a scrape can still be traced back.
    tests.sort(key=lambda t: (-t["size"], t["number"]))
    for size in (20, 10):
        group = [t for t in tests if t["size"] == size]
        for i, t in enumerate(group, 1):
            t["sourceNumber"] = t["number"]
            t["number"] = i
    ordered = [questions[k] for k in sorted(questions)]

    os.makedirs(OUT, exist_ok=True)
    qp = os.path.join(OUT, "questions.json")
    tp = os.path.join(OUT, "tests.json")
    json.dump(ordered, open(qp, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(tests, open(tp, "w"), ensure_ascii=False, separators=(",", ":"))

    # --- integrity, loudly ---
    bad_answer = [q["id"] for q in ordered
                  if q["answerId"] not in {a["id"] for a in q["answers"]}]
    missing_text = [q["id"] for q in ordered if not q["text"]["uzb"].strip()]
    dangling = sorted({qid for t in tests for qid in t["questionIds"]} - set(questions))

    print(f"questions.json  {len(ordered):>5} questions   {os.path.getsize(qp)/1024:>7.0f} KB")
    print(f"tests.json      {len(tests):>5} templates   {os.path.getsize(tp)/1024:>7.0f} KB")
    print(f"  20-question tests: {sum(1 for t in tests if t['size'] == 20)} (numbered 1..N)")
    print(f"  10-question tests: {sum(1 for t in tests if t['size'] == 10)}")
    print(f"  with image:        {sum(1 for q in ordered if q['media'])}")
    print()
    print(f"  answerId not among answers: {len(bad_answer)} {bad_answer[:5]}")
    print(f"  blank uzb text:             {len(missing_text)} {missing_text[:5]}")
    print(f"  tests referencing unknown q:{len(dangling)} {dangling[:5]}")
    return 1 if (bad_answer or dangling) else 0


if __name__ == "__main__":
    raise SystemExit(main())
