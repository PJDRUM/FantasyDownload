#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PLAYWRIGHT_PACKAGE_DIR="node_modules/playwright"

if [ ! -d "$PLAYWRIGHT_PACKAGE_DIR" ]; then
  echo "Installing Playwright package for Consensus scraping..."
  npm install --no-save playwright
fi

echo "Installing Chromium for Consensus scraping..."
if [[ "$(uname -s)" == "Linux" ]]; then
  npx playwright install --with-deps chromium
else
  npx playwright install chromium
fi

echo "Pulling fresh Consensus data..."
node scripts/consensus_scrape.mjs

echo "Updating Consensus timestamp..."
TZ=America/New_York node update-consensus-last-updated.mjs src/data/rankings.ts

echo "Consensus update complete."
