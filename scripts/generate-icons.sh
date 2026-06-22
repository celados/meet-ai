#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SVG="$ROOT_DIR/public/brand/meet-ai-mark.svg"
ICONSET_DIR="$ROOT_DIR/.tmp/meet-ai.iconset"

command -v rsvg-convert >/dev/null || {
  echo "rsvg-convert is required to render icons." >&2
  exit 1
}

command -v magick >/dev/null || {
  echo "ImageMagick 'magick' is required to create favicon.ico." >&2
  exit 1
}

command -v iconutil >/dev/null || {
  echo "iconutil is required to create desktop/assets/icon.icns." >&2
  exit 1
}

mkdir -p "$ROOT_DIR/public" "$ROOT_DIR/desktop/assets" "$ICONSET_DIR"

rsvg-convert -w 180 -h 180 "$SOURCE_SVG" -o "$ROOT_DIR/public/apple-touch-icon.png"
rsvg-convert -w 192 -h 192 "$SOURCE_SVG" -o "$ROOT_DIR/public/icon-192.png"
rsvg-convert -w 512 -h 512 "$SOURCE_SVG" -o "$ROOT_DIR/public/icon-512.png"
magick "$SOURCE_SVG" -define icon:auto-resize=16,32,48 "$ROOT_DIR/public/favicon.ico"

for size in 16 32 128 256 512; do
  rsvg-convert -w "$size" -h "$size" "$SOURCE_SVG" -o "$ICONSET_DIR/icon_${size}x${size}.png"
  rsvg-convert -w "$((size * 2))" -h "$((size * 2))" "$SOURCE_SVG" -o "$ICONSET_DIR/icon_${size}x${size}@2x.png"
done

iconutil -c icns "$ICONSET_DIR" -o "$ROOT_DIR/desktop/assets/icon.icns"
