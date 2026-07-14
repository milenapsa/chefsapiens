#!/bin/sh
set -eu

INTERVAL="${INTERVAL_SECONDS:-900}"
DATA="${DATA_DIR:-/data}"
BACKUPS="${BACKUP_DIR:-/backups}"
CANONICAL_URL="${BASE_CANONICAL_URL:?required}"
CANONICAL_SHA="${BASE_CANONICAL_SHA256:?required}"
STABILIZE_SECONDS="${STABILIZE_SECONDS:-90}"
HTTP_ATTEMPTS="${HTTP_ATTEMPTS:-6}"
HTTP_DELAY="${HTTP_DELAY_SECONDS:-5}"

mkdir -p "$DATA/history" "$DATA/history-archive"

state_once() {
  if docker inspect "$1" >/dev/null 2>&1; then
    docker inspect "$1" --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}'
  else
    printf 'missing|missing|0'
  fi
}

state_stable() {
  name="$1"
  end=$(( $(date +%s) + STABILIZE_SECONDS ))
  last="$(state_once "$name")"
  while [ "$(date +%s)" -lt "$end" ]; do
    case "$last" in
      running\|healthy\|*) printf '%s' "$last"; return 0 ;;
      running\|none\|*) printf '%s' "$last"; return 0 ;;
    esac
    sleep 3
    last="$(state_once "$name")"
  done
  printf '%s' "$last"
}

http_code() {
  url="$1"
  i=1
  code=000
  while [ "$i" -le "$HTTP_ATTEMPTS" ]; do
    code="$(curl -L -sS --connect-timeout 8 --max-time 20 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || printf 000)"
    [ "$code" != 000 ] && { printf '%s' "$code"; return 0; }
    sleep "$HTTP_DELAY"
    i=$((i+1))
  done
  printf '%s' "$code"
}

admin_health() {
  i=1
  while [ "$i" -le "$HTTP_ATTEMPTS" ]; do
    out="$(docker exec chefsapiens-admin-v21-hml node -e "fetch('http://127.0.0.1:8082/healthz').then(r=>r.text()).then(console.log).catch(()=>process.exit(1))" 2>/dev/null || true)"
    printf '%s' "$out" | jq -e '.ok==true and .version=="2.1"' >/dev/null 2>&1 && { printf '%s' "$out"; return 0; }
    sleep "$HTTP_DELAY"
    i=$((i+1))
  done
  printf '{}'
}

archive_history() {
  now="$(date +%s)"
  find "$DATA/history" -type f -name '*.json' 2>/dev/null | while IFS= read -r f; do
    m="$(stat -c %Y "$f" 2>/dev/null || echo "$now")"
    age=$((now-m))
    if [ "$age" -ge 172800 ]; then
      base="$(basename "$f")"
      gzip -c "$f" > "$DATA/history-archive/$base.gz"
      rm -f "$f"
    fi
  done
}

while :; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  tmp="/tmp/drift-v33-$stamp"
  mkdir -p "$tmp"

  canonical_ok=false
  sha=""
  if curl -fsSL --retry 5 --retry-delay 3 "$CANONICAL_URL" -o "$tmp/canonical.json"; then
    sha="$(sha256sum "$tmp/canonical.json" | awk '{print $1}')"
    [ "$sha" = "$CANONICAL_SHA" ] && canonical_ok=true
  fi

  core="$(state_stable chefsapiens-rc3-hml-app)"
  portal="$(state_stable chefsapiens-portal-hml)"
  admin="$(state_stable chefsapiens-admin-v21-hml)"
  admin_rollback="$(state_stable chefsapiens-admin-v20-hml)"
  agenda="$(state_stable chefsapiens-agenda-hml)"
  prod="$(state_stable chefsapiens-prod-app)"

  root="$(http_code https://culinaria-rc3-hml.homosapiens.id/)"
  ready="$(http_code https://culinaria-rc3-hml.homosapiens.id/readyz)"
  start="$(http_code https://culinaria-rc3-hml.homosapiens.id/start)"
  checkout="$(http_code https://culinaria-rc3-hml.homosapiens.id/checkout)"
  dashboard="$(http_code https://culinaria-rc3-hml.homosapiens.id/dashboard)"
  cockpit="$(http_code https://culinaria-rc3-hml.homosapiens.id/cockpit)"
  audit="$(http_code https://culinaria-rc3-hml.homosapiens.id/audit)"
  agenda_code="$(http_code https://culinaria-rc3-hml.homosapiens.id/agenda)"
  pipeline_guard="$(http_code https://culinaria-rc3-hml.homosapiens.id/admin-api/pipeline)"
  audit_guard="$(http_code https://culinaria-rc3-hml.homosapiens.id/admin-api/audit)"
  rotation_guard="$(http_code https://culinaria-rc3-hml.homosapiens.id/admin-api/audit/status)"
  prod_root="$(http_code https://chefsapiens.homosapiens.id/)"
  admin_json="$(admin_health)"

  jq -n \
    --arg generated_at "$ts" \
    --arg sha "$sha" \
    --argjson canonical_ok "$canonical_ok" \
    --arg core "$core" --arg portal "$portal" --arg admin "$admin" \
    --arg admin_rollback "$admin_rollback" --arg agenda "$agenda" --arg production "$prod" \
    --arg root "$root" --arg ready "$ready" --arg start "$start" --arg checkout "$checkout" \
    --arg dashboard "$dashboard" --arg cockpit "$cockpit" --arg audit "$audit" --arg agenda_code "$agenda_code" \
    --arg pipeline_guard "$pipeline_guard" --arg audit_guard "$audit_guard" --arg rotation_guard "$rotation_guard" \
    --arg prod_root "$prod_root" --argjson admin_health "$admin_json" \
    '{
      schema:"chefsapiens.drift-report.v3.3",
      generated_at:$generated_at,
      environment:"homologation",
      stabilization:{seconds:'"$STABILIZE_SECONDS"',http_attempts:'"$HTTP_ATTEMPTS"',http_delay_seconds:'"$HTTP_DELAY"'},
      canonical:{base_sha256:$sha,integrity_ok:$canonical_ok},
      containers:{
        core:$core,portal:$portal,admin_v21:$admin,admin_v20_rollback:$admin_rollback,
        agenda:$agenda,production:$production
      },
      endpoints:{
        homologation_root:($root|tonumber),readyz:($ready|tonumber),start:($start|tonumber),
        checkout:($checkout|tonumber),dashboard:($dashboard|tonumber),cockpit:($cockpit|tonumber),
        audit:($audit|tonumber),agenda:($agenda_code|tonumber),
        pipeline_guard_without_key:($pipeline_guard|tonumber),
        audit_guard_without_key:($audit_guard|tonumber),
        rotation_guard_without_key:($rotation_guard|tonumber),
        production_root:($prod_root|tonumber)
      },
      admin_health:$admin_health,
      security:{secrets_in_report:false,protected_admin_data_accessed:false},
      retention:{mode:"compress_without_deletion",compress_after_seconds:172800}
    }' > "$tmp/report.json"

  jq '
    [
      (.canonical.integrity_ok == true),
      (.containers.core|startswith("running|healthy|")),
      (.containers.portal|startswith("running|healthy|")),
      (.containers.admin_v21|startswith("running|healthy|")),
      (.containers.agenda|startswith("running|healthy|")),
      (.containers.production|startswith("running|healthy|")),
      (.endpoints.homologation_root == 200),(.endpoints.readyz == 200),(.endpoints.start == 200),
      (.endpoints.checkout == 200),(.endpoints.dashboard == 200),(.endpoints.cockpit == 200),
      (.endpoints.audit == 200),(.endpoints.agenda == 200),
      (.endpoints.pipeline_guard_without_key == 401),
      (.endpoints.audit_guard_without_key == 401),
      (.endpoints.rotation_guard_without_key == 401),
      (.endpoints.production_root == 200),
      (.admin_health.ok == true),(.admin_health.version == "2.1"),
      (.admin_health.auditRotation == true),(.admin_health.auditDeletion == false),
      (.admin_health.cockpitAligned == true)
    ] as $checks
    | ($checks|map(select(.==false))|length) as $count
    | .result={drift_count:$count,status:(if $count==0 then "green" else "attention" end)}
  ' "$tmp/report.json" > "$tmp/report.final.json"

  mv "$tmp/report.final.json" "$tmp/report.json"
  cp "$tmp/report.json" "$DATA/latest.json"
  cp "$tmp/report.json" "$DATA/history/$stamp.json"
  cp "$tmp/report.json" "$BACKUPS/CHEFSAPIENS_DRIFT_LATEST.json"
  printf '%s\n' "$DATA/latest.json" > "$BACKUPS/LAST_CHEFSAPIENS_DRIFT_REPORT"

  archive_history
  echo "DRIFT_V33_COMPLETED status=$(jq -r .result.status "$tmp/report.json") count=$(jq -r .result.drift_count "$tmp/report.json") at=$ts"
  rm -rf "$tmp"
  [ "${RUN_ONCE:-false}" = true ] && exit 0
  sleep "$INTERVAL"
done
