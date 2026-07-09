#!/usr/bin/env bash
# Push secrets from .env to the Cloudflare Worker via wrangler secret put.
# Also applies non-secret Turnstile/Resend flags to D1 app_settings.
# Usage: npm run secrets:push
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
cd "$ROOT"
export PATH="${HOME}/.local/node/bin:${PATH}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env" >&2
  exit 1
fi

python3 - "$ENV_FILE" <<'PY'
import json, os, subprocess, sys
from pathlib import Path

env_path = Path(sys.argv[1])
vals = {}
for line in env_path.read_text(encoding="utf-8").splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, _, v = s.partition("=")
    k, v = k.strip(), v.strip()
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        v = v[1:-1]
    vals[k] = v

# Export for child processes
for k, v in vals.items():
    os.environ[k] = v

def put_secret(name: str) -> None:
    value = vals.get(name) or ""
    if not value:
        print(f"skip {name} (empty)")
        return
    subprocess.run(
        ["npx", "wrangler", "secret", "put", name],
        input=value.encode(),
        check=True,
        stdout=subprocess.DEVNULL,
    )
    print(f"put {name}")

print("Pushing Worker secrets…")
for name in (
    "SESSION_SECRET",
    "CREDENTIALS_KEY",
    "TURNSTILE_SECRET_KEY",
    "RESEND_API_KEY",
    "ADMIN_EMAIL",
    "ADMIN_EMAILS",
):
    put_secret(name)

site = (vals.get("TURNSTILE_SITE_KEY") or "").replace("'", "''")
from_email = (vals.get("RESEND_FROM_EMAIL") or "WWebConsole <noreply@wwebconsole.com>").replace("'", "''")
ts_on = "1" if vals.get("TURNSTILE_ENABLED", "1").lower() in ("1", "true", "yes") else "0"
rs_key = vals.get("RESEND_API_KEY") or ""
rs_on = (
    "1"
    if vals.get("RESEND_ENABLED", "0").lower() in ("1", "true", "yes") and rs_key
    else "0"
)

stmts = [
    f"UPDATE app_settings SET value='{ts_on}', updated_at=strftime('%s','now')*1000 WHERE key='turnstile_enabled'",
    f"UPDATE app_settings SET value='{rs_on}', updated_at=strftime('%s','now')*1000 WHERE key='resend_enabled'",
    f"UPDATE app_settings SET value='{from_email}', updated_at=strftime('%s','now')*1000 WHERE key='resend_from_email'",
]
if site:
    stmts.append(
        f"UPDATE app_settings SET value='{site}', updated_at=strftime('%s','now')*1000 WHERE key='turnstile_site_key'"
    )
if vals.get("TURNSTILE_SECRET_KEY"):
    stmts.append(
        "UPDATE app_settings SET value='', updated_at=strftime('%s','now')*1000 WHERE key='turnstile_secret_key'"
    )
if rs_key:
    stmts.append(
        "UPDATE app_settings SET value='', updated_at=strftime('%s','now')*1000 WHERE key='resend_api_key'"
    )

sql = "; ".join(stmts)
subprocess.check_call(
    ["npx", "wrangler", "d1", "execute", "wwebconsole-db", "--remote", "--json", "--command", sql],
    stdout=subprocess.DEVNULL,
)
print(f"D1 flags: turnstile_enabled={ts_on} resend_enabled={rs_on}")
if rs_on == "0" and not rs_key:
    print("NOTE: RESEND_API_KEY empty — left resend_enabled=0. Add key to .env and re-run.")
print("Done. Redeploy if wrangler.jsonc vars changed: npm run deploy")
PY
