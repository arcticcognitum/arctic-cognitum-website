#!/usr/bin/env bash
# Re-encode site imagery for the web.
# Usage: tools/encode-images.sh
#   - assets/plate-*.png      → assets/plate-*.webp   (q80, same dimensions)
#   - brand/ac-mark.png       → brand/ac-mark-180.png (apple-touch-icon)
#   - assets/og-image.jpg     ← plate-applied-intelligence.png, 1200×630 JPEG
# Requires: cwebp, ffmpeg, sips (macOS).
set -euo pipefail
cd "$(dirname "$0")/.."

for f in assets/plate-*.png; do
  out="${f%.png}.webp"
  cwebp -quiet -q 80 "$f" -o "$out"
  echo "✓ $out ($(du -h "$out" | cut -f1))"
done

sips -s format png -z 180 180 brand/ac-mark.png --out brand/ac-mark-180.png >/dev/null
echo "✓ brand/ac-mark-180.png ($(du -h brand/ac-mark-180.png | cut -f1))"

ffmpeg -loglevel error -y -i assets/plate-applied-intelligence.png \
  -vf "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" \
  -q:v 4 assets/og-image.jpg
echo "✓ assets/og-image.jpg ($(du -h assets/og-image.jpg | cut -f1))"
