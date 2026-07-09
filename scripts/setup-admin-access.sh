#!/usr/bin/env bash
# Creates Cloudflare Access (OTP) for admin.wwebconsole.com
# Requires a token with Account → Cloudflare Access → Edit
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
TOKEN="${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
OTP_IDP_ID="${ACCESS_OTP_IDP_ID:-e3eb2195-dd0b-4832-a3d9-31dc5aa83480}"

BODY=$(cat <<EOF
{
  "name": "WWebConsole Admin",
  "type": "self_hosted",
  "domain": "admin.wwebconsole.com",
  "session_duration": "24h",
  "auto_redirect_to_identity": true,
  "allowed_idps": ["${OTP_IDP_ID}"],
  "app_launcher_visible": false,
  "policies": [
    {
      "name": "Admin OTP allowlist",
      "decision": "allow",
      "include": [
        { "email": { "email": "it.apexsinc@gmail.com" } },
        { "email": { "email": "ts.apexsinc@gmail.com" } },
        { "email": { "email": "apexsinc@gmail.com" } }
      ],
      "require": [
        { "login_method": { "id": "${OTP_IDP_ID}" } }
      ],
      "exclude": []
    }
  ]
}
EOF
)

curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/access/apps" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "${BODY}" | tee /tmp/wwc-access-create.json

echo
echo "Done. Allowed emails must use One-time PIN IdP."
