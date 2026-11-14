#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_AUDIT_TOKEN:?Missing CLOUDFLARE_AUDIT_TOKEN}"
: "${CLOUDFLARE_ZONE_ID:?Missing CLOUDFLARE_ZONE_ID}"

API="https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/settings"
settings_json="$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_AUDIT_TOKEN" "$API")"

python3 - <<'PY' "$settings_json" "ops/cloudflare-expected.json"
import json, sys

actual = {item["id"]: item["value"] for item in json.loads(sys.argv[1]).get("result", [])}
expected = json.load(open(sys.argv[2]))["zoneSettings"]

mismatches = []
for key, want in expected.items():
    got = actual.get(key)
    if got != want:
        mismatches.append(f"{key}: expected={want!r}, actual={got!r}")

if mismatches:
    print("Cloudflare settings drift detected:")
    for line in mismatches:
        print(" -", line)
    sys.exit(1)

print("Cloudflare zone settings match ops/cloudflare-expected.json")
PY
