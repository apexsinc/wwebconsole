#!/usr/bin/env bash
# Setup CLI shims for node, npm, npx, wrangler (and .cmd variants)
set -euo pipefail

mkdir -p "${HOME}/.local/bin"

# 1. Detect Node runtime
NODE_EXEC="$(command -v node 2>/dev/null || true)"
if [[ -z "$NODE_EXEC" || ! -x "$NODE_EXEC" ]]; then
  for candidate in \
    "${HOME}/.local/node/bin" \
    $(ls -d "${HOME}/.antigravity-ide-server/bin"/*/ 2>/dev/null | tail -n 1) \
    "${HOME}/.local/bin" \
    "/usr/local/bin"; do
    if [[ -x "${candidate}/node" ]]; then
      NODE_EXEC="${candidate}/node"
      break
    fi
  done
fi

if [[ -z "$NODE_EXEC" ]]; then
  echo "Error: Node.js executable not found." >&2
  exit 1
fi

NODE_DIR="$(dirname "$NODE_EXEC")"
echo "Found Node runtime at: $NODE_EXEC"

# 2. Add ~/.local/node/bin and ~/.local/bin to ~/.bashrc if missing
for dir in "$NODE_DIR" "${HOME}/.local/bin"; do
  if ! grep -qs "$dir" "${HOME}/.bashrc" 2>/dev/null; then
    echo "export PATH=\"${dir}:\$PATH\"" >> "${HOME}/.bashrc"
  fi
done

# 3. Create .cmd compatibility wrappers so Windows-style commands work in bash
cat << 'EOF' > "${HOME}/.local/bin/npm.cmd"
#!/bin/sh
exec npm "$@"
EOF
chmod +x "${HOME}/.local/bin/npm.cmd"

cat << 'EOF' > "${HOME}/.local/bin/npx.cmd"
#!/bin/sh
exec npx "$@"
EOF
chmod +x "${HOME}/.local/bin/npx.cmd"

cat << 'EOF' > "${HOME}/.local/bin/wrangler.cmd"
#!/bin/sh
exec wrangler "$@"
EOF
chmod +x "${HOME}/.local/bin/wrangler.cmd"

echo "CLI shims installed successfully."
echo "Reload your shell with: source ~/.bashrc"
