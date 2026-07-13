#!/bin/sh
set -eu

INTERVAL="${INTERVAL_SECONDS:-900}"
DATA_DIR="${DATA_DIR:-/data}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BASE_CANONICAL_URL="${BASE_CANONICAL_URL:?required}"
BASE_CANONICAL_SHA256="${BASE_CANONICAL_SHA256:?required}"
mkdir -p "$DATA_DIR/history"

http_code() {
  curl -L -sS -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || printf '000'
}

container_state() {
  name="$1"
  if docker inspect "$name" >/dev/null 2>&1; then
    docker inspect "$name" --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}'
  else
    printf 'missing|missing|0'
  fi
}

while :; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  tmp="/tmp/drift-v2-$stamp"
  mkdir -p "$tmp"

  canonical_ok=false
  canonical_sha=""
  if curl -fsSL "$BASE_CANONICAL_URL" -o "$tmp/canonical.json"; then
    canonical_sha="$(sha256sum "$tmp/canonical.json" | awk '{print $1}')"
    [ "$canonical_sha" = "$BASE_CANONICAL_SHA256" ] && canonical_ok=true
  fi

  core="$(container_state chefsapiens-rc3-hml-app)"
  portal="$(container_state chefsapiens-portal-hml)"
  admin="$(container_state chefsapiens-admin-v20-hml)"
  admin_rollback="$(container_state chefsapiens-admin-hml)"
  agenda="$(container_state chefsapiens-agenda-hml)"
  production="$(container_state chefsapiens-prod-app)"

  hml_root="$(http_code https://culinaria-rc3-hml.homosapiens.id/)"
  readyz="$(http_code https://culinaria-rc3-hml.homosapiens.id/readyz)"
  start="$(http_code https://culinaria-rc3-hml.homosapiens.id/start)"
  checkout="$(http_code https://culinaria-rc3-hml.homosapiens.id/checkout)"
  dashboard="$(http_code https://culinaria-rc3-hml.homosapiens.id/dashboard)"
  cockpit="$(http_code https://culinaria-rc3-hml.homosapiens.id/cockpit)"
  audit="$(http_code https://culinaria-rc3-hml.homosapiens.id/audit)"
  agenda_code="$(http_code https://culinaria-rc3-hml.homosapiens.id/agenda)"
  pipeline_guard="$(http_code https://culinaria-rc3-hml.homosapiens.id/admin-api/pipeline)"
  audit_guard="$(http_code https://culinaria-rc3-hml.homosapiens.id/admin-api/audit)"
  prod_root="$(http_code https://chefsapiens.homosapiens.id/)"

  admin_health="$(docker exec chefsapiens-admin-v20-hml node -e "fetch('http://127.0.0.1:8082/healthz').then(r=>r.text()).then(console.log).catch(()=>process.exit(1))" 2>/dev/null || printf '{}')"

  drift=0
  [ "$canonical_ok" = true ] || drift=$((drift+1))
  for state in "$core" "$portal" "$admin" "$agenda" "$production"; do
    status="${state%%|*}"; rest="${state#*|}"; health="${rest%%|*}"
    [ "$status" = running ] || drift=$((drift+1))
    case "$health" in healthy|none) ;; *) drift=$((drift+1));; esac
  done
  for code in "$hml_root" "$readyz" "$start" "$checkout" "$dashboard" "$cockpit" "$audit" "$agenda_code" "$prod_root"; do
    [ "$code" = 200 ] || drift=$((drift+1))
  done
  [ "$pipeline_guard" = 401 ] || drift=$((drift+1))
  [ "$audit_guard" = 401 ] || drift=$((drift+1))
  echo "$admin_health" | jq -e '.ok and .version=="2.0" and .audit and .originGuard and .leadValidation and .serializedWrites' >/dev/null 2>&1 || drift=$((drift+1))

  jq -n \
    --arg generated_at "$ts" \
    --arg canonical_sha256 "$canonical_sha" \
    --argjson canonical_ok "$canonical_ok" \
    --arg core "$core" \
    --arg portal "$portal" \
    --arg admin "$admin" \
    --arg admin_rollback "$admin_rollback" \
    --arg agenda "$agenda" \
    --arg production "$production" \
    --arg hml_root "$hml_root" \
    --arg readyz "$readyz" \
    --arg start "$start" \
    --arg checkout "$checkout" \
    --arg dashboard "$dashboard" \
    --arg cockpit "$cockpit" \
    --arg audit "$audit" \
    --arg agenda_code "$agenda_code" \
    --arg pipeline_guard "$pipeline_guard" \
    --arg audit_guard "$audit_guard" \
    --arg prod_root "$prod_root" \
    --argjson admin_health "$admin_health" \
    --argjson drift "$drift" \
    '{
      schema:"chefsapiens.drift-report.v2",
      generated_at:$generated_at,
      environment:"homologation",
      canonical:{base_sha256:$canonical_sha256,integrity_ok:$canonical_ok},
      containers:{core:$core,portal:$portal,admin_v20:$admin,admin_v18_rollback:$admin_rollback,agenda:$agenda,production:$production},
      endpoints:{
        homologation_root:($hml_root|tonumber),
        readyz:($readyz|tonumber),
        start:($start|tonumber),
        checkout:($checkout|tonumber),
        dashboard:($dashboard|tonumber),
        cockpit:($cockpit|tonumber),
        audit:($audit|tonumber),
        agenda:($agenda_code|tonumber),
        pipeline_guard_without_key:($pipeline_guard|tonumber),
        audit_guard_without_key:($audit_guard|tonumber),
        production_root:($prod_root|tonumber)
      },
      admin_health:$admin_health,
      result:{drift_count:$drift,status:(if $drift==0 then "green" else "attention" end)},
      security:{secrets_in_report:false,protected_admin_data_accessed:false}
    }' > "$tmp/report.json"

  cp "$tmp/report.json" "$DATA_DIR/latest.json"
  cp "$tmp/report.json" "$DATA_DIR/history/$stamp.json"
  cp "$tmp/report.json" "$BACKUP_DIR/CHEFSAPIENS_DRIFT_LATEST.json"
  printf '%s\n' "$DATA_DIR/latest.json" > "$BACKUP_DIR/LAST_CHEFSAPIENS_DRIFT_REPORT"
  echo "DRIFT_V2_COMPLETED status=$(jq -r '.result.status' "$tmp/report.json") count=$(jq -r '.result.drift_count' "$tmp/report.json") at=$ts"
  rm -rf "$tmp"

  [ "${RUN_ONCE:-false}" = true ] && exit 0
  sleep "$INTERVAL"
done