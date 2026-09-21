#!/usr/bin/env python3
"""
Download every question image referenced by the e-avtomaktab scrapes.

Originals only: no resizing, no re-encoding. Sign/headlight detail must stay intact.

Resumable: a file already on disk whose size matches the server's Content-Length
is skipped, so an interrupted run costs nothing to restart.

    python3 scripts/download_images.py            # download
    python3 scripts/download_images.py --check    # list what's missing, download nothing
"""

import json
import os
import sys
import glob
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRAPES = os.path.join(ROOT, "scrapes")
OUT_DIR = os.path.join(SCRAPES, "images")
MANIFEST = os.path.join(SCRAPES, "images-manifest.json")

WORKERS = 6           # modest: it's a small nginx box, no need to hammer it
RETRIES = 3
TIMEOUT = 60
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def collect_urls():
    """
    Every distinct media URL across both scrape sets, mapped to the question IDs
    using it.

    tests-20 (composed, Sept) is newer than tests-10 (Aug). A handful of questions
    had their image re-uploaded under a new filename in between; the old URL now
    404s. So when a question appears in both sets, only the newer URL is kept --
    otherwise we'd chase dead files forever.
    """
    newer, older = {}, {}

    def note(bucket, qid, media):
        media = (media or "").strip()
        if media.startswith("http"):
            bucket.setdefault(qid, set()).add(media)

    for path in glob.glob(os.path.join(SCRAPES, "tests-20", "*.json")):
        for test in json.load(open(path)).values():
            for q in test.get("questions", []):
                note(newer, q["id"], q.get("media"))
                for a in q.get("answers", []):
                    note(newer, q["id"], a.get("media"))

    for path in glob.glob(os.path.join(SCRAPES, "tests-10", "*.json")):
        body = json.loads(json.load(open(path))["body"])
        for q in body.get("questions", []):
            note(older, q["id"], q.get("media"))
            for a in q.get("answers", []):
                note(older, q["id"], a.get("media"))

    urls = {}
    for qid in set(newer) | set(older):
        for media in newer.get(qid) or older.get(qid, set()):
            urls.setdefault(media, set()).add(qid)

    return {u: sorted(ids) for u, ids in urls.items()}


def remote_size(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return int(r.headers.get("Content-Length") or 0)
    except Exception:
        return 0


def fetch(url):
    """Returns (status, bytes). status: skipped | ok | failed"""
    name = url.rsplit("/", 1)[-1].split("?")[0]
    dest = os.path.join(OUT_DIR, name)

    if os.path.exists(dest):
        local = os.path.getsize(dest)
        with open(dest, "rb") as fh:
            head = fh.read(12)
        looks_ok = (head.startswith(b"\xff\xd8\xff") or head.startswith(b"\x89PNG\r\n\x1a\n")
                    or head[:6] in (b"GIF87a", b"GIF89a")
                    or (head[:4] == b"RIFF" and head[8:12] == b"WEBP"))
        if looks_ok and local > 0 and local == remote_size(url):
            return ("skipped", local, name, None)

    last = None
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                data = r.read()
            if not data:
                raise ValueError("empty response")
            # e-avtomaktab serves its SPA index.html (status 200!) for images that
            # don't exist, so trust magic bytes rather than the status code.
            if not (data.startswith(b"\xff\xd8\xff")        # jpeg
                    or data.startswith(b"\x89PNG\r\n\x1a\n")  # png
                    or data[:6] in (b"GIF87a", b"GIF89a")
                    or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")):
                head = data[:60].decode("utf-8", "replace").strip().replace("\n", " ")
                raise ValueError(f"not an image (got {len(data)}B: {head!r})")
            tmp = dest + ".part"
            with open(tmp, "wb") as fh:
                fh.write(data)
            os.replace(tmp, dest)          # atomic: no half-written file on Ctrl-C
            return ("ok", len(data), name, None)
        except Exception as e:
            last = e
            if attempt < RETRIES - 1:
                time.sleep(1.5 * (attempt + 1))
    return ("failed", 0, name, str(last))


def main():
    check_only = "--check" in sys.argv
    urls = collect_urls()
    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"{len(urls)} distinct image URLs referenced by the scrapes")

    if check_only:
        missing = [u for u in urls if not os.path.exists(os.path.join(OUT_DIR, u.rsplit('/', 1)[-1]))]
        print(f"on disk: {len(urls) - len(missing)}   missing: {len(missing)}")
        for u in missing[:40]:
            print("  missing:", u)
        if len(missing) > 40:
            print(f"  ... and {len(missing) - 40} more")
        return 0

    done = {"ok": 0, "skipped": 0, "failed": 0}
    total_bytes = 0
    failures = []
    started = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for i, (status, size, name, err) in enumerate(pool.map(fetch, urls), 1):
            done[status] += 1
            total_bytes += size
            if status == "failed":
                failures.append((name, err))
            if i % 25 == 0 or i == len(urls):
                el = time.time() - started
                print(f"  [{i}/{len(urls)}] ok={done['ok']} skipped={done['skipped']} "
                      f"failed={done['failed']}  {total_bytes/1048576:.0f} MB  {el:.0f}s", flush=True)

    manifest = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "https://e-avtomaktab.uz/storage/tests/",
        "note": "originals, unmodified - no resize, no re-encode",
        "count": len(urls),
        "images": {u.rsplit("/", 1)[-1]: {"url": u, "questionIds": ids} for u, ids in sorted(urls.items())},
    }
    with open(MANIFEST, "w") as fh:
        json.dump(manifest, fh, indent=2)

    on_disk = sum(os.path.getsize(os.path.join(OUT_DIR, f))
                  for f in os.listdir(OUT_DIR) if not f.endswith(".part"))
    print(f"\ndownloaded={done['ok']}  already had={done['skipped']}  failed={done['failed']}")
    print(f"{OUT_DIR}  ->  {on_disk/1048576:.0f} MB")
    print(f"manifest    ->  {MANIFEST}")
    if failures:
        print("\nfailed (re-run to retry just these):")
        for name, err in failures[:20]:
            print(f"  {name}: {err}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
