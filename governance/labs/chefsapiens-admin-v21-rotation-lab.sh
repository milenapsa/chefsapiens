#!/bin/sh
set -eu
A=chefsapiens-admin-v21-hml
L=chefsapiens-rotation-lab
V=chefsapiens-rotation-lab-data
N=gateway-health_default
B=https://culinaria-rc3-hml.homosapiens.id
cleanup(){ docker rm -f "$L" >/dev/null 2>&1||true; docker volume rm "$V" >/dev/null 2>&1||true; rm -f /tmp/lab.env /tmp/p.json; }
trap cleanup EXIT INT TERM HUP
cleanup
K="$(docker inspect "$A" --format '{{range .Config.Env}}{{println .}}{{end}}'|sed -n 's/^ADMIN_API_KEY=//p'|head -n1)"
test -n "$K"
curl -fsS -H "x-admin-key: $K" "$B/admin-api/pipeline">/tmp/p.json
ID="$(jq -r '.data.leads[0].id//empty' /tmp/p.json)"
test -n "$ID"
docker volume create "$V">/dev/null
umask 077
printf 'ADMIN_API_KEY=%s\nDATA_DIR=/data\nALLOWED_ORIGIN=https://rotation-lab.local\nCORE_URL=http://chefsapiens-rc3-hml-app:8080\nAUDIT_ROTATE_BYTES=65536\n' "$K">/tmp/lab.env
docker run -d --name "$L" --network "$N" --env-file /tmp/lab.env -v "$V:/data" --read-only --tmpfs /tmp --security-opt no-new-privileges:true --cap-drop ALL node:22-alpine /bin/sh -lc 'set -eu;cd /tmp;wget -q https://raw.githubusercontent.com/milenapsa/chefsapiens/f1615c7bfac00e454cfe21d1d4ed77d8261edf1d/admin/v2.1/server.mjs -O server.mjs;echo "10bd37bc2d264fb69b13dd8441e218493451b94985da5ef993c29713be316669  server.mjs"|sha256sum -c -;exec node server.mjs'>/dev/null
rm -f /tmp/lab.env
for i in $(seq 1 60);do docker exec "$L" node -e "fetch('http://127.0.0.1:8082/healthz').then(r=>r.json()).then(j=>process.exit(j.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1&&break;sleep 1;done
docker exec -e LEAD_ID="$ID" -e EVENTS=420 "$L" node --input-type=module -e "const id=process.env.LEAD_ID,n=+process.env.EVENTS,k=process.env.ADMIN_API_KEY,b='http://127.0.0.1:8082';for(let i=1;i<=n;i++){const x={stage:i%2?'proposal':'contacted',owner:'Rotation Lab',nextAction:'Synthetic '+i,nextActionAt:new Date(Date.now()+i*60000).toISOString(),notes:'LAB_'+i};const r=await fetch(b+'/admin-api/pipeline/'+encodeURIComponent(id),{method:'PATCH',headers:{Origin:'https://rotation-lab.local','x-admin-key':k,'content-type':'application/json'},body:JSON.stringify(x)});if(!r.ok)throw Error('patch '+i+' '+r.status)}const r=await fetch(b+'/admin-api/audit/status',{headers:{'x-admin-key':k}}),j=await r.json();if(!r.ok||j.data.archiveCount<1||j.data.manifestEntries<1||j.data.deletionEnabled!==false)throw Error(JSON.stringify(j));console.log(JSON.stringify(j.data))"
docker exec "$L" node --input-type=module -e "import fs from'node:fs';import p from'node:path';import c from'node:crypto';const d='/data/audit-archive',ls=fs.readFileSync(p.join(d,'manifest.jsonl'),'utf8').trim().split('\n').filter(Boolean);if(!ls.length)throw Error('empty');for(const s of ls){const e=JSON.parse(s),x=fs.readFileSync(p.join(d,e.file)),h=c.createHash('sha256').update(x).digest('hex');if(h!==e.sha256||x.length!==e.bytes||e.deleted!==false)throw Error(e.file)}console.log('ROTATION_MANIFEST_SHA256_OK entries='+ls.length)"
docker restart "$L">/dev/null
sleep 3
docker exec "$L" node --input-type=module -e "const k=process.env.ADMIN_API_KEY,b='http://127.0.0.1:8082';const r=await fetch(b+'/admin-api/audit/status',{headers:{'x-admin-key':k}}),j=await r.json();if(!r.ok||j.data.archiveCount<1)throw Error('persist');console.log('ROTATION_RESTART_PERSISTENCE_OK')"
docker cp "$L:/data/audit-archive/manifest.jsonl" /backups/CHEFSAPIENS_ROTATION_LAB_MANIFEST.jsonl
printf '%s\n' 'isolated synthetic lab; no real homologation or production data modified'>/backups/CHEFSAPIENS_ROTATION_LAB_NOTE.txt
test "$(curl -sS -o /dev/null -w '%{http_code}' https://chefsapiens.homosapiens.id/)" = 200
echo PRODUCTION_200
cleanup
trap - EXIT INT TERM HUP
echo ROTATION_LAB_CLEANUP_OK
echo CHEFSAPIENS_ROTATION_LAB_OK
