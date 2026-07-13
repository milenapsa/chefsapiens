#!/bin/sh
set -eu

INTERVAL="${INTERVAL_SECONDS:-900}"
DATA_DIR="${DATA_DIR:-/data}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
CANONICAL_URL="${CANONICAL_URL:?required}"
EXPECTED_SHA256="${EXPECTED_SHA256:?required}"

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

json_escape() {
  jq -Rn --arg v "$1" '$v'
}

while :; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  tmp="/tmp/drift-$stamp"
  mkdir -p "$tmp"

  canonical_ok=false
  canonical_sha=""
  if curl -fsSL "$CANONICAL_URL" -o "$tmp/canonical.json"; then
    canonical_sha="$(sha256sum "$tmp/canonical.json" | awk '{print $1}')"
    [ "$canonical_sha" = "$EXPECTED_SHA256" ] && canonical_ok=true
  fi

  core_state="$(container_state chefsapiens-rc3-hml-app)"
  portal_state="$(container_state chefsapiens-portal-hml)"
  admin_state="$(container_state chefsapiens-admin-hml)"
  agenda_state="$(container_state chefsapiens-agenda-hml)"
  prod_state="$(container_state chefsapiens-prod-app)"

  hml_root="$(http_code https://culinaria-rc3-hml.homosapiens.id/)"
  readyz="$(http_code https://culinaria-rc3-hml.homosapiens.id/readyz)"
  start="$(http_code https://culinaria-rc3-hml.homosapiens.id/start)"
  checkout="$(http_code https://culinaria-rc3-hml.homosapiens.id/checkout)"
  dashboard="$(http_code https://culinaria-rc3-hml.homosapiens.id/dashboard)"
  cockpit="$(http_code https://culinaria-rc3-hml.homosapiens.id/cockpit)"
  agenda="$(http_code https://culinaria-rc3-hml.homosapiens.id/agenda)"
  admin_guard="$(http_code https://culinaria-rc3-hml.homosapiens.id/admin-api/pipeline)"
  production="$(http_code https://chefsapiens.homosapiens.id/)"

  core_health="$(curl -fsSL https://culinaria-rc3-hml.homosapiens.id/readyz 2>/dev/null || printf '{}')"
  portal_health="$(docker exec chefsapiens-portal-hml node -e "fetch('http://127.0.0.1:8081/healthz').then(r=>r.text()).then(console.log).catch(()=>process.exit(1))" 2>/dev/null || printf '{}')"
  admin_health="$(docker exec chefsapiens-admin-hml node -e "fetch('http://127.0.0.1:8082/healthz').then(r=>r.text()).then(console.log).catch(()=>process.exit(1))" 2>/dev/null || printf '{}')"
  agenda_health="$(docker exec chefsapiens-agenda-hml node -e "fetch('http://127.0.0.1:8083/healthz').then(r=>r.text()).then(console.log).catch(()=>process.exit(1))" 2>/dev/null || printf '{}')"

  drift=0
  [ "$canonical_ok" = true ] || drift=$((drift+1))
  for s in "$core_state" "$portal_state" "$admin_state" "$agenda_state" "$prod_state"; do
    status="${s%%|*}"
    rest="${s#*|}"
    health="${rest%%|*}"
    [ "$status" = "running" ] || drift=$((drift+1))
    case "$health" in healthy|none) ;; *) drift=$((drift+1));; esac
  done
  for code in "$hml_root" "$readyz" "$start" "$checkout" "$dashboard" "$cockpit" "$agenda" "$production"; do
    [ "$code" = "200" ] || drift=$((drift+1))
  done
  [ "$admin_guard" = "401" ] || drift=$((drift+1))

  jq -n \
    --arg schema "chefsapiens.drift-report.v1" \
    --arg generated_at "$ts" \
    --arg canonical_sha256 "$canonical_sha" \
    --argjson canonical_ok "$canonical_ok" \
    --arg core_state "$core_state" \
    --arg portal_state "$portal_state" \
    --arg admin_state "$admin_state" \
    --arg agenda_state "$agenda_state" \
    --arg production_state "$prod_state" \
    --arg hml_root "$hml_root" \
    --arg readyz "$readyz" \
    --arg start "$start" \
    --arg checkout "$checkout" \
    --arg dashboard "$dashboard" \
    --arg cockpit "$cockpit" \
    --arg agenda "$agenda" \
    --arg admin_guard "$admin_guard" \
    --arg production "$production" \
    --argjson core_health "$core_health" \
    --argjson portal_health "$portal_health" \
    --argjson admin_health "$admin_health" \
    --argjson agenda_health "$agenda_health" \
    --argjson drift_count "$drift" \
    '{
      schema:$schema,
      generated_at:$generated_at,
      environment:"homologation",
      canonical:{sha256:$canonical_sha256,integrity_ok:$canonical_ok},
      containers:{
        core:$core_state,
        portal:$portal_state,
        admin:$admin_state,
        agenda:$agenda_state,
        production:$production_state
      },
      endpoints:{
        homologation_root:($hml_root|tonumber),
        readyz:($readyz|tonumber),
        start:($start|tonumber),
        checkout:($checkout|tonumber),
        dashboard:($dashboard|tonumber),
        cockpit:($cockpit|tonumber),
        agenda:($agenda|tonumber),
        admin_guard_without_key:($admin_guard|tonumber),
        production_root:($production|tonumber)
      },
      health:{
        core:$core_health,
        portal:$portal_health,
        admin:$admin_health,
        agenda:$agenda_health
      },
      result:{
        drift_count:$drift_count,
        status:(if $drift_count==0 then "green" else "attention" end)
      },
      security:{
        secrets_in_report:false,
        protected_admin_data_accessed:false
      }
    }' > "$tmp/report.json"

  cp "$tmp/report.json" "$DATA_DIR/latest.json"
  cp "$tmp/report.json" "$DATA_DIR/history/$stamp.json"
  cp "$tmp/report.json" "$BACKUP_DIR/CHEFSAPIENS_DRIFT_LATEST.json"
  printf '%s\n' "$DATA_DIR/latest.json" > "$BACKUP_DIR/LAST_CHEFSAPIENS_DRIFT_REPORT"

  echo "DRIFT_CHECK_COMPLETED status=$(jq -r '.result.status' "$tmp/report.json") count=$(jq -r '.result.drift_count' "$tmp/report.json") at=$ts"
  rm -rf "$tmp"

  [ "${RUN_ONCE:-false}" = "true" ] && exit 0
  sleep "$INTERVAL"
done
