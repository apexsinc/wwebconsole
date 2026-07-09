#!/usr/bin/env bash
# Create Cloudflare rate limiting rules for wwebconsole.com (Rulesets API).
#
# Free plan: 1 rule, characteristics=["ip.src"], period/mitigation_timeout=10 only.
# Pro+: can add more rules / longer windows (see docs/security/cloudflare-hardening.md).
#
# Requires CLOUDFLARE_API_TOKEN with Zone → Zone WAF → Edit (or Account Rulesets Edit).
# Loads keys from .env (safe parser — do not bash-source .env; angle brackets break it).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/node/bin:${PATH}"

python3 - <<'PY'
import json, sys, urllib.error, urllib.request
from pathlib import Path

root = Path(".").resolve()
env_path = root / ".env"
vals = {}
if env_path.is_file():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, _, v = s.partition("=")
        k, v = k.strip(), v.strip()
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        vals[k] = v

account_id = vals.get("CLOUDFLARE_ACCOUNT_ID") or ""
token = vals.get("CLOUDFLARE_API_TOKEN") or ""
zone_id = vals.get("ZONE_ID") or ""
plan = (vals.get("CF_PLAN") or "free").lower()

if not token:
    sys.exit("Missing CLOUDFLARE_API_TOKEN in .env")
if not account_id:
    print("NOTE: CLOUDFLARE_ACCOUNT_ID unset (only needed for some account APIs)", file=sys.stderr)

def api(method, url, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            err = json.load(e)
        except Exception:
            err = {"success": False, "errors": [{"message": e.read().decode()[:500]}]}
        err["_http_status"] = e.code
        return err

if not zone_id:
    z = api("GET", "https://api.cloudflare.com/client/v4/zones?name=wwebconsole.com")
    if not z.get("success") or not z.get("result"):
        print(json.dumps(z, indent=2))
        sys.exit("Could not resolve ZONE_ID for wwebconsole.com — set ZONE_ID in .env")
    zone_id = z["result"][0]["id"]
    print(f"ZONE_ID={zone_id}", file=sys.stderr)

# Free: one rule, IP only, 10s windows. Pro+: richer rules (still capped by plan).
if plan in ("pro", "business", "enterprise"):
    rules_payload = [
        {
            "action": "block",
            "expression": '(http.request.uri.path eq "/api/auth/login")',
            "description": "WWC rate limit login",
            "ratelimit": {
                "characteristics": ["cf.colo.id", "ip.src"],
                "period": 60,
                "requests_per_period": 20,
                "mitigation_timeout": 60,
            },
        },
        {
            "action": "block",
            "expression": '(http.request.uri.path eq "/api/auth/register")',
            "description": "WWC rate limit register",
            "ratelimit": {
                "characteristics": ["cf.colo.id", "ip.src"],
                "period": 60,
                "requests_per_period": 10,
                "mitigation_timeout": 60,
            },
        },
        {
            "action": "block",
            "expression": '(http.request.uri.path in {"/api/auth/verify-email" "/api/auth/reset-password" "/api/auth/forgot-password"})',
            "description": "WWC rate limit OTP auth",
            "ratelimit": {
                "characteristics": ["cf.colo.id", "ip.src"],
                "period": 60,
                "requests_per_period": 20,
                "mitigation_timeout": 60,
            },
        },
        {
            "action": "block",
            "expression": '(starts_with(http.request.uri.path, "/api/public/tv/"))',
            "description": "WWC rate limit public TV",
            "ratelimit": {
                "characteristics": ["cf.colo.id", "ip.src"],
                "period": 60,
                "requests_per_period": 120,
                "mitigation_timeout": 60,
            },
        },
        {
            "action": "block",
            "expression": '(http.host eq "admin.wwebconsole.com" and starts_with(http.request.uri.path, "/api/admin/"))',
            "description": "WWC rate limit admin API",
            "ratelimit": {
                "characteristics": ["cf.colo.id", "ip.src"],
                "period": 60,
                "requests_per_period": 60,
                "mitigation_timeout": 60,
            },
        },
    ]
else:
    # Free Website: 1 rule, characteristics=["ip.src"], period & mitigation_timeout = 10
    rules_payload = [
        {
            "action": "block",
            "expression": '(starts_with(http.request.uri.path, "/api/auth/"))',
            "description": "WWC rate limit auth API",
            "ratelimit": {
                "characteristics": ["ip.src"],
                "period": 10,
                "requests_per_period": 20,
                "mitigation_timeout": 10,
            },
        },
    ]
    print(
        "Using Free-plan rule set (1 rule on /api/auth/*). Set CF_PLAN=pro in .env for more rules.",
        file=sys.stderr,
    )

list_url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets"
listed = api("GET", list_url)
if not listed.get("success"):
    print(json.dumps(listed, indent=2))
    sys.exit(1)

phase = "http_ratelimit"
existing = None
for rs in listed.get("result") or []:
    if rs.get("phase") == phase and rs.get("kind") in ("zone", "root"):
        if rs.get("kind") == "zone" or existing is None:
            existing = rs

if existing:
    ruleset_id = existing["id"]
    print(f"Updating ruleset {ruleset_id} ({phase})…", file=sys.stderr)
    detail = api("GET", f"https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/{ruleset_id}")
    if not detail.get("success"):
        print(json.dumps(detail, indent=2))
        sys.exit(1)
    current_rules = detail["result"].get("rules") or []
    kept = [r for r in current_rules if not str(r.get("description", "")).startswith("WWC rate limit")]
    new_rules = kept + rules_payload
    result = api(
        "PUT",
        f"https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/{ruleset_id}",
        {"rules": new_rules},
    )
else:
    print(f"Creating zone ruleset for {phase}…", file=sys.stderr)
    result = api(
        "POST",
        f"https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets",
        {
            "name": "WWebConsole rate limits",
            "kind": "zone",
            "phase": phase,
            "rules": rules_payload,
        },
    )

print(
    json.dumps(
        {
            "success": result.get("success"),
            "errors": result.get("errors"),
            "messages": result.get("messages"),
            "ruleset_id": (result.get("result") or {}).get("id"),
            "rule_count": len((result.get("result") or {}).get("rules") or []),
        },
        indent=2,
    )
)
if not result.get("success"):
    print(
        "\nAPI could not create rate-limit rules (token missing Zone WAF Edit, or plan limits).\n"
        "Dashboard (Free = 1 rule):\n"
        "  Security → WAF → Rate limiting rules → Create rule\n"
        "  Match: URI Path starts with /api/auth/\n"
        "  Rate: 20 requests / 10 seconds / IP → Block\n"
        "Also ensure the API token includes: Zone → Zone WAF → Edit\n"
        "See docs/security/cloudflare-hardening.md",
        file=sys.stderr,
    )
    sys.exit(1)
print("Rate limiting rules applied.", file=sys.stderr)
PY
