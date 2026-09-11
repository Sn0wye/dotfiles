#!/usr/bin/env bash
set -euo pipefail

DEST="${HOME}/Pictures/wallpaper.jpeg"

[[ -e "$DEST" ]] || { printf 'error: missing %s (stow --adopt . first)\n' "$DEST" >&2; exit 1; }

osascript -e "tell application \"System Events\" to tell every desktop to set picture to POSIX file \"${DEST}\""
printf 'wallpaper: %s\n' "$DEST"
