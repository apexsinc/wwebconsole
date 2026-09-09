#!/usr/bin/env bash
# Wrangler CLI runner wrapper
# Usage: bash scripts/wrangler.sh <command> (e.g. bash scripts/wrangler.sh deploy)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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
exec "$NODE_BIN" "${ROOT}/node_modules/.bin/wrangler" "$@"
