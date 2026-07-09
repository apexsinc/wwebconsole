#!/usr/bin/env bash
# Optional: create Cloudflare Rate Limiting rules for wwebconsole.com
# Requires: CLOUDFLARE_API_TOKEN (Zone WAF Write), CLOUDFLARE_ACCOUNT_ID, ZONE_ID
# Usage:
#   ZONE_ID=... CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... bash scripts/setup-waf-rate-limits.sh
#
# If the API rejects (plan/permission), create the same rules in the dashboard:
#   Security → WAF → Rate limiting rules
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
TOKEN="${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
ZONE_ID="${ZONE_ID:?set ZONE_ID (Cloudflare zone id for wwebconsole.com)}"

python3 - "$ACCOUNT_ID" "$TOKEN" "$ZONE_ID" <<'PY'
import json, sys, urllib.error, urllib.request

account_id, token, zone_id = sys.argv[1:4]

# Cloudflare Rulesets API — rate limiting phase (may require Pro+)
# Documented fallback: create equivalent rules in dashboard if this fails.
rules = [
    {
        "description": "WWC auth login rate limit",
        "expression": '(http.request.uri.path eq "/api/auth/login")',
        "action": "block",
        "ratelimit": {
            "characteristics": ["cf.colo.id", "ip.src"],
            "period": 900,
            "requests_per_period": 20,
            "mitigation_timeout": 900,
        },
    },
    {
        "description": "WWC auth register rate limit",
        "expression": '(http.request.uri.path eq "/api/auth/register")',
        "action": "block",
        "ratelimit": {
            "characteristics": ["cf.colo.id", "ip.src"],
            "period": 3600,
            "requests_per_period": 10,
            "mitigation_timeout": 3600,
        },
    },
    {
        "description": "WWC public TV rate limit",
        "expression": '(starts_with(http.request.uri.path, "/api/public/tv/"))',
        "action": "block",
        "ratelimit": {
            "characteristics": ["cf.colo.id", "ip.src"],
            "period": 60,
            "requests_per_period": 120,
            "mitigation_timeout": 60,
        },
    },
]

print("Attempting to list zone rate limit rulesets…", file=sys.stderr)
url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req) as r:
        listed = json.load(r)
except urllib.error.HTTPError as e:
    listed = json.load(e)
    print(json.dumps(listed, indent=2))
    print(
        "\nAPI list failed. Create rate limiting rules manually in Zero Trust / WAF dashboard.\n"
        "See docs/security/cloudflare-hardening.md",
        file=sys.stderr,
    )
    sys.exit(1)

print(json.dumps({"success": listed.get("success"), "result_count": len(listed.get("result") or [])}, indent=2))
print(
    "\nRuleset list OK. Creating/updating rate-limit rulesets via API varies by plan.\n"
    "Recommended: add the three rules described in docs/security/cloudflare-hardening.md "
    "under Security → WAF → Rate limiting rules.\n"
    f"Suggested expressions:\n"
    f"  1) {rules[0]['expression']} → 20 / 15m\n"
    f"  2) {rules[1]['expression']} → 10 / 1h\n"
    f"  3) {rules[2]['expression']} → 120 / 1m\n",
    file=sys.stderr,
)
PY
