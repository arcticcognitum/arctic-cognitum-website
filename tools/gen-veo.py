#!/usr/bin/env python3
"""Generate a background video from a still image using Veo 3.1 (image-to-video).

Usage:
  GEMINI_API_KEY=... .veo-venv/bin/python tools/gen-veo.py \
      --image assets/plate-standing-advisory.png \
      --out raw/standing-advisory.mp4 \
      --prompt "..." [--duration 8] [--model veo-3.1-generate-preview]

Requires a Gemini API key with billing enabled (Veo is a paid preview model).
"""
import argparse
import os
import sys
import time
from pathlib import Path

from google import genai
from google.genai import types


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True, help="input still image path")
    ap.add_argument("--out", required=True, help="output mp4 path")
    ap.add_argument("--prompt", required=True, help="motion prompt")
    ap.add_argument("--negative", default="text, watermark, people, fast motion, camera shake, zoom",
                    help="negative prompt")
    ap.add_argument("--duration", type=int, default=8, choices=[4, 6, 8])
    ap.add_argument("--resolution", default="1080p", choices=["720p", "1080p", "4k"])
    ap.add_argument("--aspect", default="16:9")
    ap.add_argument("--model", default="veo-3.1-generate-preview")
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: set GEMINI_API_KEY (or GOOGLE_API_KEY).", file=sys.stderr)
        return 2

    img_path = Path(args.image)
    if not img_path.exists():
        print(f"ERROR: image not found: {img_path}", file=sys.stderr)
        return 2

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    client = genai.Client(api_key=api_key)
    image = types.Image.from_file(location=str(img_path))

    config_kwargs = dict(
        aspect_ratio=args.aspect,
        resolution=args.resolution,
        number_of_videos=1,
        duration_seconds=args.duration,
    )
    if args.negative:  # some models (e.g. Lite) reject negative_prompt
        config_kwargs["negative_prompt"] = args.negative
    config = types.GenerateVideosConfig(**config_kwargs)

    print(f"→ submitting to {args.model} ({args.duration}s, {args.resolution}, {args.aspect})")
    operation = client.models.generate_videos(
        model=args.model,
        prompt=args.prompt,
        image=image,
        config=config,
    )

    waited = 0
    while not operation.done:
        time.sleep(10)
        waited += 10
        print(f"  …generating ({waited}s elapsed)")
        operation = client.operations.get(operation)

    if getattr(operation, "error", None):
        print(f"ERROR: generation failed: {operation.error}", file=sys.stderr)
        return 1

    video = operation.response.generated_videos[0]
    client.files.download(file=video.video)
    video.video.save(str(out_path))
    print(f"✓ saved {out_path} ({out_path.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
