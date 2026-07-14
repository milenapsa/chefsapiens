#!/bin/sh
set -eu

INTERVAL="${INTERVAL_SECONDS:-900}"
DATA="${DATA_DIR:-/data}"
BACKUPS="${BACKUP_DIR:-/backups}"
CANONICAL_URL="${BASE_CANONICAL_URL:?required}"
CANONICAL_SHA="${BASE_CANONICAL_SHA256:?required}"
ATTEMPTS="${HTTP_ATTEMPTS:-6}"
DELAY="${HTTP_DELAY_SECONDS:-5}"

mkdir -p "$DATA/history" "$DATA/history-archive"

probe() {
  url="$1"
  i=1
  code=000
  while [ "$i" -le "$ATTEMPTS" ]; do
    code="$(curl -sS --connect-timeout 5 --max-time 15 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || printf 000)"
    [ "$code" != 000 ] && { printf '%s' "$code"; return 0; }
    sleep "$DELAY"
    i=$((i+1))
  done
  printf '%s' "$code"
}

get_json() {
  url="$1"
  i=1
  while [ "$i" -le "$ATTEMPTS" ]; do
    out="$(curl -fsS --connect-timeout 5 --max-time 15 "$url" 2>/dev/null || true)"
    printf '%s' "$out" | jq -e . >/dev/null 2>&1 && { printf '%s' "$out"; return 0; }
    sleep "$DELAY"
    i=$((i+1))
  done
  printf '{}'
}

archive_history() {
  now="$(date +%s)"
  find "$DATA/history" -type f -name '*.json' 2>/dev/null | while IFS= read -r f; do
    m="$(stat -c %Y "$f" 2>/dev/null || echo "$now")"
    [ $((now-m)) -ge 172800 ] || continue
    base="$(basename "$f")"
    gzip -c "$f" > "$DATA/history-archive/$base.gz"
    rm -f "$f"
  done
}

while :; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  tmp="/tmp/drift-v4-$stamp"
  mkdir -p "$tmp"

  canonical_ok=false
  sha=""
  if curl -fsSL --retry 5 --retry-delay 3 "$CANONICAL_URL" -o "$tmp/canonical.json"; then
    sha="$(sha256sum "$tmp/canonical.json" | awk '{print $1}')"
    [ "$sha" = "$CANONICAL_SHA" ] && canonical_ok=true
  fi

  core_ready="$(probe http://chefsapiens-rc3-hml-app:8080/readyz)"
  portal_start="$(probe http://chefsapiens-portal-hml:8081/start)"
  portal_checkout="$(probe http://chefsapiens-portal-hml:8081/checkout)"
  portal_dashboard="$(probe http://chefsapiens-portal-hml:8081/dashboard)"
  admin_health_code="$(probe http://chefsapiens-admin-v21-hml:8082/healthz)"
  admin_cockpit="$(probe http://chefsapiens-admin-v21-hml:8082/cockpit)"
  admin_audit="$(probe http://chefsapiens-admin-v21-hml:8082/audit)"
  pipeline_guard="$(probe http://chefsapiens-admin-v21-hml:8082/admin-api/pipeline)"
  audit_guard="$(probe http://chefsapiens-admin-v21-hml:8082/admin-api/audit)"
  rotation_guard="$(probe http://chefsapiens-admin-v21-hml:8082/admin-api/audit/status)"
  rollback_health="$(probe http://chefsapiens-admin-v20-hml:8082/healthz)"
  agenda="$(probe http://chefsapiens-agenda-hml:8083/agenda)"
  production="$(probe https://chefsapiens.homosapiens.id/)"
  public_hml="$(probe https://culinaria-rc3-hml.homosapiens.id/)"
  admin_json="$(get_json http://chefsapiens-admin-v21-hml:8082/healthz)"

  jq -n \
    --arg generated_at "$ts" --arg sha "$sha" --argjson canonical_ok "$canonical_ok" \
    --arg core_ready "$core_ready" --arg portal_start "$portal_start" \
    --arg portal_checkout "$portal_checkout" --arg portal_dashboard "$portal_dashboard" \
    --arg admin_health_code "$admin_health_code" --arg admin_cockpit "$admin_cockpit" \
    --arg admin_audit "$admin_audit" --arg pipeline_guard "$pipeline_guard" \
    --arg audit_guard "$audit_guard" --arg rotation_guard "$rotation_guard" \
    --arg rollback_health "$rollback_health" --arg agenda "$agenda" \
    --arg production "$production" --arg public_hml "$public_hml" \
    --argjson admin_health "$admin_json" \
    '{
      schema:"chefsapiens.drift-report.v4",
      generated_at:$generated_at,
      environment:"homologation",
      monitor_security:{
        docker_socket_mounted:false,
        transport:"private_service_network",
        mutation_capability:false
      },
      canonical:{base_sha256:$sha,integrity_ok:$canonical_ok},
      private_checks:{
        core_readyz:($core_ready|tonumber),
        portal_start:($portal_start|tonumber),
        portal_checkout:($portal_checkout|tonumber),
        portal_dashboard:($portal_dashboard|tonumber),
        admin_health:($admin_health_code|tonumber),
        admin_cockpit:($admin_cockpit|tonumber),
        admin_audit:($admin_audit|tonumber),
        pipeline_guard_without_key:($pipeline_guard|tonumber),
        audit_guard_without_key:($audit_guard|tonumber),
        rotation_guard_without_key:($rotation_guard|tonumber),
        admin_v20_rollback_health:($rollback_health|tonumber),
        agenda:($agenda|tonumber)
      },
      public_checks:{
        production_root:($production|tonumber),
        homologation_root_observational:($public_hml|tonumber),
        homologation_root_counted_as_drift:false
      },
      admin_health:$admin_health,
      retention:{mode:"compress_without_deletion",compress_after_seconds:172800},
      security:{secrets_in_report:false,protected_admin_data_accessed:false}
    }' > "$tmp/report.json"

  jq '
    [
      (.canonical.integrity_ok == true),
      (.private_checks.core_readyz == 200),
      (.private_checks.portal_start == 200),
      (.private_checks.portal_checkout == 200),
      (.private_checks.portal_dashboard == 200),
      (.private_checks.admin_health == 200),
      (.private_checks.admin_cockpit == 200),
      (.private_checks.admin_audit == 200),
      (.private_checks.pipeline_guard_without_key == 401),
      (.private_checks.audit_guard_without_key == 401),
      (.private_checks.rotation_guard_without_key == 401),
      (.private_checks.admin_v20_rollback_health == 200),
      (.private_checks.agenda == 200),
      (.public_checks.production_root == 200),
      (.admin_health.ok == true),
      (.admin_health.version == "2.1"),
      (.admin_health.auditRotation == true),
      (.admin_health.auditDeletion == false),
      (.admin_health.cockpitAligned == true)
    ] as $checks
    | ($checks|map(select(.==false))|length) as $count
    | .result={drift_count:$count,status:(if $count==0 then "green" else "attention" end)}
  ' "$tmp/report.json" > "$tmp/final.json"

  mv "$tmp/final.json" "$tmp/report.json"
  cp "$tmp/report.json" "$DATA/latest.json"
  cp "$tmp/report.json" "$DATA/history/$stamp.json"
  cp "$tmp/report.json" "$BACKUPS/CHEFSAPIENS_DRIFT_LATEST.json"
  printf '%s\n' "$DATA/latest.json" > "$BACKUPS/LAST_CHEFSAPIENS_DRIFT_REPORT"
  archive_history

  echo "DRIFT_V4_COMPLETED status=$(jq -r .result.status "$tmp/report.json") count=$(jq -r .result.drift_count "$tmp/report.json") at=$ts"
  rm -rf "$tmp"
  [ "${RUN_ONCE:-false}" = true ] && exit 0
  sleep "$INTERVAL"
done
