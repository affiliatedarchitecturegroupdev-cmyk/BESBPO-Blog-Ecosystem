#!/usr/bin/env bash
# Onboards tenants via the REAL Admin API
# (besbpo-blog-syndication-svc's POST /api/v1/tenants — Doc-02 Section 5),
# rather than hand-writing SQL against the tenants table. This is
# deliberate: running this script is itself a live exercise of the
# onboarding flow Doc-02 Section 3 describes (Request → Provisioning →
# Integration → Verification → Go-live), not just a data-loading step.
#
# Originally written for the Phase 4 pilot wave (defaults to
# pilot-tenants.json for exact backward compatibility with that usage);
# generalized in Phase 8 to onboard ANY manifest file in the same shape —
# see full-rollout-tenants.template.json for the intake format the
# remaining 25+ subsidiary sites should be onboarded from once real
# company details exist for them (see ../FULL-ROLLOUT.md for why this
# repo does not fabricate placeholder companies to hit "30+").
#
# Requires: curl, python3 (used for JSON handling — no jq dependency).
#
# Usage:
#   ADMIN_JWT=<token> ./onboard-pilot-tenants.sh                          # onboards pilot-tenants.json (Phase 4 default)
#   ADMIN_JWT=<token> ./onboard-pilot-tenants.sh --file manifest.json     # onboards any manifest in the same shape
#   ./onboard-pilot-tenants.sh --dry-run                                  # print payloads, call nothing
#   ./onboard-pilot-tenants.sh --file manifest.json --dry-run             # combine both
#
# See ../PILOT-WAVE.md for the Phase 4 process, ../FULL-ROLLOUT.md for the
# Phase 8 full-rollout process, and each besbpo-subsidiary-site-* repo's
# README for what happens after this script returns an api_key.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_FILE="$SCRIPT_DIR/pilot-tenants.json"
ADMIN_API_BASE_URL="${ADMIN_API_BASE_URL:-http://localhost:8080}"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --file)
      MANIFEST_FILE="$2"
      shift 2
      ;;
    *)
      echo "ERROR: unrecognized argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$DRY_RUN" != true ]]; then
  : "${ADMIN_JWT:?Set ADMIN_JWT to a valid admin bearer token before running this script (or pass --dry-run)}"
fi

if [[ ! -f "$MANIFEST_FILE" ]]; then
  echo "ERROR: manifest file not found at $MANIFEST_FILE" >&2
  exit 1
fi

count=$(python3 -c "import json; print(len(json.load(open('$MANIFEST_FILE'))))")
echo "Found $count tenant(s) to onboard from $MANIFEST_FILE against $ADMIN_API_BASE_URL"
echo ""

for i in $(seq 0 $((count - 1))); do
  name=$(python3 -c "import json; print(json.load(open('$MANIFEST_FILE'))[$i]['name'])")
  payload=$(python3 -c "import json; print(json.dumps(json.load(open('$MANIFEST_FILE'))[$i]))")

  echo "=== Onboarding: $name ==="

  if [[ "$DRY_RUN" == true ]]; then
    echo "$payload" | python3 -m json.tool
    echo "(--dry-run: no request sent)"
    echo ""
    continue
  fi

  http_status=$(curl -sS -o /tmp/pilot-onboard-response.json -w "%{http_code}" \
    -X POST "$ADMIN_API_BASE_URL/api/v1/tenants" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Content-Type: application/json" \
    -d "$payload") || {
      echo "ERROR: curl request failed for $name" >&2
      continue
    }

  if [[ "$http_status" != "201" ]]; then
    echo "ERROR: expected HTTP 201, got $http_status for $name. Response:" >&2
    cat /tmp/pilot-onboard-response.json >&2
    echo ""
    continue
  fi

  python3 -m json.tool < /tmp/pilot-onboard-response.json
  echo ""
  echo "IMPORTANT: the api_key above is shown exactly once (Doc-02 Section 3)."
  echo "Copy it and the tenant_id into this tenant's config.json and index.html now,"
  echo "then enable GitHub Pages for its repo."
  echo ""
done

rm -f /tmp/pilot-onboard-response.json
echo "Done. Verify each tenant per PILOT-WAVE.md's (or FULL-ROLLOUT.md's) verification checklist before declaring it live."
