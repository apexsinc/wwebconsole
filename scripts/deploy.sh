#!/usr/bin/env bash
# Build and deploy the wwebconsole Cloudflare Worker
# Usage: bash scripts/deploy.sh or npm run deploy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Resolve Node runtime from ~/.local/node/bin, antigravity ide server, or PATH
NODE_BIN="$(command -v node 2>/dev/null || true)"
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  for candidate in \
    "${HOME}/.local/node/bin" \
    $(ls -d "${HOME}/.antigravity-ide-server/bin"/*/ 2>/dev/null | tail -n 1) \
    "${HOME}/.local/bin" \
    "/usr/local/bin"; do
    if [[ -x "${candidate}/node" ]]; then
      export PATH="${candidate}:${PATH}"
      NODE_BIN="${candidate}/node"
      break
    fi
  done
fi

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Error: Node runtime not found." >&2
  exit 1
fi

export PATH="${ROOT}/node_modules/.bin:${HOME}/.local/node/bin:${PATH}"

echo "Building client with Vite..."
"$NODE_BIN" "${ROOT}/node_modules/.bin/vite" build

echo "Sanitizing dist..."
"$NODE_BIN" -e "const fs=require('fs'); for (const p of ['dist/wwebconsole/.dev.vars','dist/client/.dev.vars']) { try { fs.unlinkSync(p); } catch {} }"

echo "Deploying Worker via Wrangler..."
"$NODE_BIN" "${ROOT}/node_modules/.bin/wrangler" deploy "$@"
