#!/usr/bin/env bash
set -euo pipefail

# GitHub release asset has a readable name. Aerials still requires this UUID filename.
ASSET_ID="35693AEA-F8C4-4A80-B77D-C94B20A68956"
RELEASE_URL="https://github.com/Sn0wye/dotfiles/releases/download/aerial-screensaver/aerial-screensaver.mov"
EXPECTED_BYTES=506446144
TAHOE="${HOME}/Library/Application Support/com.apple.wallpaper/aerials/videos"
LEGACY="/Library/Application Support/com.apple.idleassetsd/Customer/4KSDR240FPS"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

dest_dir() {
  if [[ -d "$TAHOE" ]]; then
    printf '%s\n' "$TAHOE"
    return
  fi
  if [[ -d "$LEGACY" ]]; then
    printf '%s\n' "$LEGACY"
    return
  fi
  mkdir -p "$TAHOE"
  printf '%s\n' "$TAHOE"
}

ready() {
  local path="$1"
  [[ -f "$path" ]] || return 1
  local size
  size="$(stat -f%z "$path" 2>/dev/null || echo 0)"
  [[ "$size" -eq "$EXPECTED_BYTES" ]]
}

DIR="$(dest_dir)"
DEST="${DIR}/${ASSET_ID}.mov"

if ready "$DEST"; then
  printf 'aerial: already installed %s\n' "$DEST"
  exit 0
fi

TMP="${DEST}.tmp"
mkdir -p "$DIR"
printf 'aerial: downloading aerial-screensaver.mov\n'
if [[ -w "$DIR" ]]; then
  curl -L --fail --retry 3 -C - -o "$TMP" "$RELEASE_URL"
  mv -f "$TMP" "$DEST"
else
  die "${DIR} is not writable (older macOS idleassetsd path needs sudo)"
fi

ready "$DEST" || die "download size mismatch: ${DEST}"
killall idleassetsd WallpaperAgent WallpaperAerial 2>/dev/null || true
printf 'aerial: %s\n' "$DEST"
printf 'aerial: Screen Saver → Aerials → Los Angeles if this Mac has not used that clip yet\n'
