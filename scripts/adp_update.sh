#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
DEFAULT_PYTHON="python3"

if ! command -v "$DEFAULT_PYTHON" >/dev/null 2>&1; then
  echo "python3 is not installed on this machine."
  exit 1
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "Creating local Python environment in .venv..."
  "$DEFAULT_PYTHON" -m venv "$VENV_DIR"
fi

echo "Installing ADP Python packages..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$ROOT_DIR/requirements-adp.txt"

if [ "${1:-}" = "--setup-only" ]; then
  echo "ADP setup complete."
  exit 0
fi

echo "Pulling fresh ADP data..."
"$VENV_DIR/bin/python" "$ROOT_DIR/scripts/adp_scrape.py"

echo "Updating ADP timestamp..."
TZ=America/New_York node "$ROOT_DIR/update-adp-last-updated.mjs" "$ROOT_DIR/src/data/rankings.ts"

echo "ADP update complete."
