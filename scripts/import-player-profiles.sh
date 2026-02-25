#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/Volumes/XMacMiniM4/Programs/PlayerProfiles}"

node "scripts/import-player-profiles.mjs" "$ROOT"
