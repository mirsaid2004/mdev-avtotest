#!/usr/bin/env bash
# Upload the question images to Cloudflare R2.
#
# Prereqs: brew install rclone, and an "r2" remote configured (see README_R2.md).
#
#   ./scripts/upload_r2.sh <bucket-name>
#
# Safe to re-run: rclone only transfers files that are missing or changed.

set -euo pipefail

BUCKET="${1:-}"
[ -z "$BUCKET" ] && { echo "usage: $0 <bucket-name>"; exit 1; }

SRC="$(cd "$(dirname "$0")/.." && pwd)/scrapes/images"
[ -d "$SRC" ] || { echo "missing $SRC - run download_images.py first"; exit 1; }

echo "uploading $(ls "$SRC" | wc -l | tr -d ' ') files ($(du -sh "$SRC" | cut -f1)) -> r2:$BUCKET/tests/"
echo

rclone copy "$SRC" "r2:$BUCKET/tests" \
  --header-upload "Cache-Control: public, max-age=31536000, immutable" \
  --transfers 16 \
  --checkers 32 \
  --s3-no-check-bucket \
  --progress \
  --stats-one-line

echo
echo "verifying..."
rclone check "$SRC" "r2:$BUCKET/tests" --size-only --one-way
echo
echo "done. remote now holds:"
rclone size "r2:$BUCKET/tests"
