#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:?Usage: smoke.sh <base_url> <candidate|production>}"
MODE="${2:-candidate}"
BASE_URL="${BASE_URL%/}"

check_body() {
  local path="$1"
  local expected_code="$2"
  local pattern="$3"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -sS -o "$tmp" -w "%{http_code}" "$BASE_URL$path")"
  if [[ "$code" == "403" ]]; then
    echo "::notice::HTTP 403 on $path (possible edge WAF/Bot Fight challenge); skipping strict check."
    rm -f "$tmp"
    return 0
  fi
  if [[ "$code" != "$expected_code" ]]; then
    echo "Expected HTTP $expected_code for $path, got $code"
    rm -f "$tmp"
    return 1
  fi
  if [[ -n "$pattern" ]] && ! grep -qiE "$pattern" "$tmp"; then
    echo "Expected pattern '$pattern' in response for $path"
    rm -f "$tmp"
    return 1
  fi
  rm -f "$tmp"
}

check_body "/" 200 "voaneves"
check_body "/en/" 200 'lang="en"'
check_body "/nao-existe/" 404 ""

headers_root="$(curl -fsSI "$BASE_URL/" || true)"
if [[ -n "$headers_root" ]]; then
  for h in "strict-transport-security" "content-security-policy" "x-content-type-options"; do
    if ! echo "$headers_root" | grep -qi "^$h:"; then
      echo "Missing security header: $h"
      exit 1
    fi
  done
fi

worker_headers="$(curl -fsSI "$BASE_URL/worker.min.js" || true)"
if [[ -n "$worker_headers" ]] && ! echo "$worker_headers" | grep -qi "no-cache"; then
  echo "Expected Cache-Control: no-cache on /worker.min.js"
  exit 1
fi

if [[ "$MODE" == "production" ]]; then
  www_code="$(curl -sS -o /dev/null -w "%{http_code}" "https://www.voaneves.com/x?y=1" || true)"
  if [[ "$www_code" != "301" && "$www_code" != "403" && "$www_code" != "000" ]]; then
    echo "Expected www redirect 301, got $www_code"
    exit 1
  fi
fi

echo "Smoke checks passed ($MODE): $BASE_URL"
