#!/usr/bin/env bash
# Turn a raw Veo clip into web-ready, seamlessly-looping background video.
# Usage: tools/encode-web.sh raw/standing-advisory.mp4 assets/video/standing-advisory
#   arg1 = input mp4   arg2 = output basename (no extension)
# Produces <base>.mp4 (H.264) and <base>.webm (VP9), muted, 1080p, boomerang-looped.
set -euo pipefail

IN="${1:?input mp4 required}"
BASE="${2:?output basename required}"
WIDTH="${WIDTH:-1920}"          # downscale target width
LOOP="${LOOP:-1}"               # 1 = boomerang (forward+reverse) for seamless loop
MP4_CRF="${MP4_CRF:-23}"        # H.264 quality (higher = smaller)
WEBM_CRF="${WEBM_CRF:-32}"      # VP9 quality (higher = smaller)

mkdir -p "$(dirname "$BASE")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SRC="$IN"
if [ "$LOOP" = "1" ]; then
  echo "→ building seamless boomerang loop"
  ffmpeg -y -loglevel error -i "$IN" \
    -filter_complex "[0:v]reverse[r];[0:v][r]concat=n=2:v=1:a=0" \
    -an "$TMP/loop.mp4"
  SRC="$TMP/loop.mp4"
fi

SCALE="scale=${WIDTH}:-2:flags=lanczos,format=yuv420p"

echo "→ encoding H.264 MP4"
ffmpeg -y -loglevel error -i "$SRC" -an \
  -vf "$SCALE" -c:v libx264 -profile:v high -crf ${MP4_CRF} -preset slow \
  -movflags +faststart "${BASE}.mp4"

echo "→ encoding VP9 WebM"
ffmpeg -y -loglevel error -i "$SRC" -an \
  -vf "$SCALE" -c:v libvpx-vp9 -crf ${WEBM_CRF} -b:v 0 -row-mt 1 "${BASE}.webm"

echo "✓ done:"
ls -lh "${BASE}.mp4" "${BASE}.webm" | awk '{print "   "$5"  "$9}'
