#!/usr/bin/env bash
# Creates Cloudflare Access (email OTP) for admin.wwebconsole.com
# Requires a token with Account → Cloudflare Access → Edit
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
TOKEN="${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
OTP_IDP_ID="${ACCESS_OTP_IDP_ID:-e3eb2195-dd0b-4832-a3d9-31dc5aa83480}"

python3 - "$ACCOUNT_ID" "$TOKEN" "$OTP_IDP_ID" <<'PY'
import json, sys, urllib.error, urllib.request

account_id, token, otp_id = sys.argv[1:4]
body = {
    "name": "WWebConsole Admin",
    "type": "self_hosted",
    "domain": "admin.wwebconsole.com",
    "session_duration": "24h",
    "auto_redirect_to_identity": True,
    "allowed_idps": [otp_id],
    "app_launcher_visible": False,
    "policies": [
        {
            "name": "Admin OTP allowlist",
            "decision": "allow",
            "include": [
                {"email": {"email": "it.apexsinc@gmail.com"}},
                {"email": {"email": "ts.apexsinc@gmail.com"}},
                {"email": {"email": "apexsinc@gmail.com"}},
            ],
            "require": [{"login_method": {"id": otp_id}}],
            "exclude": [],
        }
    ],
}

# If an app already exists for this domain, update it instead of failing
list_req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{account_id}/access/apps?per_page=100",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(list_req) as r:
    listed = json.load(r)

existing = None
for app in listed.get("result") or []:
    domains = []
    if app.get("domain"):
        domains.append(app["domain"])
    domains.extend(app.get("domains") or [])
    if "admin.wwebconsole.com" in domains or app.get("name") == "WWebConsole Admin":
        existing = app
        break

if existing:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/access/apps/{existing['id']}"
    method = "PUT"
    print(f"Updating existing Access app {existing['id']}…", file=sys.stderr)
else:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/access/apps"
    method = "POST"
    print("Creating Access app…", file=sys.stderr)

req = urllib.request.Request(
    url,
    data=json.dumps(body).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method=method,
)
try:
    with urllib.request.urlopen(req) as r:
        result = json.load(r)
except urllib.error.HTTPError as e:
    result = json.load(e)
    print(json.dumps(result, indent=2))
    sys.exit(1)

print(json.dumps(result, indent=2))
if not result.get("success"):
    sys.exit(1)
print("Done. Allowed emails must use One-time PIN IdP.", file=sys.stderr)
PY
