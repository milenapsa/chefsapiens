#!/bin/sh
set -eu

ACTIVE="chefsapiens-admin-v21-hml"
LAB="chefsapiens-admin-v21-rotation-lab"
VOL="chefsapiens-admin-v21-rotation-lab-data"
NET="gateway-health_default"
BASE=https://culinaria-rc3-hml.homosapiens.id"
SERVER_URL="https://raw.githubusercontent.com/milenapsa/chefsapiens/f1615c7bfac00e454cfe21d1d4ed77d8261edf1d/admin/v2.1/server.mjs"
SERVER_SHA="10bd37bc2d264fb69b13dd8441e218493451b94985da5ef993c29713be316669"
EVENTS="${EVENTS:-420}"

cleanup() {
  docker rm -f "$LAB" >/dev/null 2>&1 || true
  docker volume rm "$VOL" >/dev/null 2>&1 || true
  rm -f /tmp/chefsapiens-rotation-lab.env /tmp/chefsapiens-rotation-pipeline.json
}
trap cleanup EXIT INT TERM HUP

# Remove only prior isolated-lab resources.
docker rm -f "$LAB" >/dev/null 2>&1 || true
docker volume rm "$VOL" >/dev/null 2>&1 || true

ADMIN_KEY="$(docker inspect "$ACTIVE" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^ADMIN_API_KEY=//p' | head -n1)"
test -n "$ADMIN_KEY"

curl -fsS -H "x-admin-key: $ADMIN_KEY" "$BASE/admin-api/pipeline" > /tmp/chefsapiens-rotation-pipeline.json
LEAD_ID="$(jq -r '.data.leads[0].id // empty' /tmp/chefsapiens-rotation-pipeline.json)"
test -n "$LEAD_ID"

docker volume create "$VOL" >/dev/null

umask 077
cat > /tmp/chefsapiens-rotation-lab.env <<EOF
ADMIN_API_KEY=$ADMIN_KEY
DATA_DIR=/data
ALLOWED_ORIGIN=https://rotation-lab.local
CORE_URL=/http://chefsapiens-rc3-hml-app:8080
AUDIT_ROTATE_BYTES=65536
EOF

docker run -d \
  --name "$LAB" \
  --network "$NET" \
  --env-file /tmp/chefsapiens-rotation-lab.env \
  -v "$VOL:/data" \
  --read-only \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  --tmpfs /tmp \
  node:22-alpine \
  /bin/sh -lc "
    set -eu
    mkdir -p /tmp/admin
    cd /tmp/admin
    wget -q '$SERVER_URL' -O server.mjs
    echo '$SERVER_SHA  server.mjs' | sha256sum -c -
    exec node server.mjs
  " >/dev/null

rm -f /tmp/chefsapiens-rotation-lab.env
unset ADMIN_KEY

ready=false
for _ in $(seq 1 60); do
  if docker exec "$LAB" node -e "fetch('http://127.0.0.1:8082/healthz').then(r=>r.json()).then(j=>process.exit(j.ok&&j.version==='2.1'?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
test "$ready" = true
echo "ROTATION_LAB_READY"

docker exec \
  -e LEAD_ID="$LEAD_ID" \
  -e EVENTS="$EVENTS" \
  "$LAB" \
  node --input-type=module - <<'NODE'
const id = process.env.LEAD_ID;
const total = Number(process.env.EVENTS || 420);
const key = process.env.ADMIN_API_KEY;
const base = 'http://127.0.0.1:8082';
for (let i = 1; i <= total; i++) {
  const body = {
    stage: i % 2 ? 'proposal' : 'contacted',
    owner: 'Rotation Lab',
    nextAction: `Synthetic isolated event ${i}`,
    nextActionAt: new Date(Date.now() + i * 60000).toISOString(),
    notes: `ROTATION_LAB_${i}`
  };
  const response = await fetch(`${base}/admin-api/pipeline/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      Origin: 'https://rotation-lab.local',
      'x-admin-key': key,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`PATCH ${i} failed: ${response.status} ${await response.text()}`);
  }
}
const statusResponse = await fetch(`${base}/admin-api/audit/status`, {
  headers: { 'x-admin-key': key }
});
if (!statusResponse.ok) throw new Error(`status failed: ${statusResponse.status}`);
const payload = await statusResponse.json();
const status = payload.data;
if (!(status.archiveCount >= 1 && status.manifestEntries >= 1 && status.deletionEnabled === false)) {
  throw new Error(`rotation not proven: ${JSON.stringify(status)}`);
}
console.log(JSON.stringify({
  events: total,
  archiveCount: status.archiveCount,
  manifestEntries: status.manifestEntries,
  currentBytes: status.currentBytes,
  deletionEnabled: status.deletionEnabled
}));
NODE

docker exec "$LAB" node --input-type=module - <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dir = '/data/audit-archive';
const manifestPath = path.join(dir, 'manifest.jsonl');
const lines = fs.readFileSync(manifestPath, 'utf8').trim().split('\n').filter(Boolean);
if (!lines.length) throw new Error('empty manifest');

for (const line of lines) {
  const entry = JSON.parse(line);
  const filePath = path.join(dir, entry.file);
  const body = fs.readFileSync(FilePath);
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  if (hash !== entry.sha256) throw new Error(`sha mismatch: ${entry.file}`);
  if (body.length !== entry.bytes) throw new Error(`size mismatch: ${entry.file}`);
  if (entry.deleted !== false) throw new Error(util deletion marker: ${entry.file}`);
}
console.log(`ROTATION_MANIFEST_SHA256_OK entries=${lines.length}`);
NODE

docker restart "$LAB" >/dev/null
ready=false
for _ in $(seq 1 60); do
  if docker exec "$LAB" node -e "fetch('http://127.0.0.1:8082/healthz').then(r=>r.json()).then(j=>process.exit(j.ok&&j.version==='2.1'?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
test "$ready" = true

docker exec "$LAB" node --input-type=module - <<'NODE'
const key = process.env.ADMIN_API_KEY;
const base = 'http://127.0.0.1:8082';
const statusResponse = await fetch(`${base}/admin-api/audit/status`, {
  headers: { 'x-admin-key': key }
});
const statusPayload = await statusResponse.json();
if (!statusResponse.ok || statusPayload.data.archiveCount < 1 || statusPayload.data.manifestEntries < 1) {
  throw new Error('rotation persistence failed');
}
const auditResponse = await fetch(`${base}/admin-api/audit?limit=20`, {
  headers: { 'x-admin-key': key }
});
const auditPayload = await auditResponse.json();
if (!auditResponse.ok || auditPayload.data.count < 1) {
  throw new Error('audit read after restart failed');
}
console.log(`ROTATION_RESTART_PERSISTENCE_OK archives=${statusPayload.data.archiveCount} events=${auditPayload.data.count}`);
NODE

docker cp "$LAB:/data/audit-archive/manifest.jsonl" /backups/CHEFSAPIENS_ROTATION_LAB_MANIFEST.jsonl
docker exec "$LAB" node --input-type=module - <<'NODE' > /backups/CHEFSAPIENS_ROTATION_LAB_SUMMARY.json
const key = process.env.ADMIN_API_KEY;
const response = await fetch('http://127.0.0.1:8082/admin-api/audit/status', {
  headers: { 'x-admin-key': key }
});
const payload = await response.json();
if (!response.ok) throw new Error('status available');
console.log(JSON.stringify({
  schema: 'chefsapiens.rotation-lab-evidence.v1',
  generatedAt: new Date().toISOString(),
  isolated: true,
  realDataModified: false,
  productionModified: false,
  mode: payload.data.mode,
  rotateBytes: payload.data.rotateBytes,
  currentBytes: payload.data.currentBytes,
  archiveCount: payload.data.archiveCount,
  manifestEntries: payload.data.manifestEntries,
  deletionEnabled: payload.data.deletionEnabled,
  manifestSha256Verified: true,
  restartPersistenceVerified: true
}, null, 2));
NODE

printf '%s\n' 'synthetic isolated lab; no production or real homologation pipeline data modified' > /backups/CHEFSAPIENS_ROTATION_LAB_NOTE.txt

test "$(curl -sS -o /dev/null -w '%{http_code}' https://chefsapiens.homosapiens.id/)" = "200"
echo "PRODUCTION_200"

# Explicit cleanup before trap.
docker rm -f "$LAB" >/dev/null
docker volume rm "$VOL" >/dev/null
rm -f /tmp/chefsapiens-rotation-pipeline.json
trap - EXIT INT TERM HUP

echo "ROTATION_LAB_CLEANUP_OK"
echo "CHEFSAPIENS_ROTATION_LAB_OK"
