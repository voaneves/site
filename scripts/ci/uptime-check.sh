#!/usr/bin/env bash
set -euo pipefail

SITE_URL="${SITE_URL:-https://voaneves.pages.dev}"
SITE_URL="${SITE_URL%/}"

write_status() {
  local status="$1"
  local detail="$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "status=$status" >> "$GITHUB_OUTPUT"
    echo "detail=$detail" >> "$GITHUB_OUTPUT"
  fi
  echo "uptime status=$status detail=$detail"
}

for path in "/" "/en/"; do
  code="$(curl -sS -m 15 -o /dev/null -w "%{http_code}" "$SITE_URL$path" || echo "000")"
  if [[ "$code" == "403" ]]; then
    echo "::notice::Edge returned 403 on $SITE_URL$path"
    continue
  fi
  if [[ "$code" != "200" ]]; then
    write_status "fail" "HTTP $code on $SITE_URL$path"
    exit 0
  fi
done

host="$(echo "$SITE_URL" | sed -E 's|^https?://([^/]+).*|\1|')"
expiry="$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)"
if [[ -n "$expiry" ]]; then
  exp_epoch="$(date -d "$expiry" +%s 2>/dev/null || echo 0)"
  now_epoch="$(date -u +%s)"
  days_left=$(( (exp_epoch - now_epoch) / 86400 ))
  if (( exp_epoch > 0 && days_left < 14 )); then
    write_status "fail" "TLS certificate expires in ${days_left}d"
    exit 0
  fi
fi

write_status "ok" "all endpoints healthy"
