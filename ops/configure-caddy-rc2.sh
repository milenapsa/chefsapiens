#!/bin/sh
set -eu
APP_CONTAINER="${APP_CONTAINER:-chefsapiens-rc2-hml-app}"
CADDY_CONTAINER="${CADDY_CONTAINER:-media-studio-caddy}"
HOSTNAME="${HML_HOSTNAME:-culinaria-hml.homosapiens.id}"
APP_PORT="${APP_PORT:-8080}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/backups/Caddyfile.before-chefsapiens-rc2-hml-${STAMP}"
echo "HML_RC2_CONFIGURE_START=${STAMP}"
docker inspect "$APP_CONTAINER" >/dev/null
docker inspect "$CADDY_CONTAINER" >/dev/null
mkdir -p /backups /work
docker cp "$CADDY_CONTAINER:/etc/caddy/Caddyfile" "$BACKUP"
cp "$BACKUP" /work/Caddyfile.current
docker inspect "$CADDY_CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' > /work/caddy.networks
test -s /work/caddy.networks
while IFS= read -r net; do
  [ -n "$net" ] || continue
  docker network connect "$net" "$APP_CONTAINER" >/dev/null 2>&1 || true
done < /work/caddy.networks
awk '
  BEGIN {skip=0}
  $0=="# BEGIN HOMOSAPIENS_CULINARIA_HML" {skip=1; next}
  $0=="# END HOMOSAPIENS_CULINARIA_HML" {skip=0; next}
  $0=="# BEGIN CHEFSAPIENS_RC2_HML" {skip=1; next}
  $0=="# END CHEFSAPIENS_RC2_HML" {skip=0; next}
  skip==0 {print}
' /work/Caddyfile.current > /work/Caddyfile.new
cat >> /work/Caddyfile.new <<EOF

# BEGIN CHEFSAPIENS_RC2_HML
${HOSTNAME} {
    encode zstd gzip
    header {
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        X-Frame-Options SAMEORIGIN
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
    reverse_proxy ${APP_CONTAINER}:${APP_PORT}
}
# END CHEFSAPIENS_RC2_HML
EOF
restore() {
  docker cp "$BACKUP" "$CADDY_CONTAINER:/etc/caddy/Caddyfile"
  docker exec "$CADDY_CONTAINER" caddy fmt --overwrite /etc/caddy/Caddyfile >/dev/null 2>&1 || true
  docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || true
}
trap restore INT TERM HUP
docker cp /work/Caddyfile.new "$CADDY_CONTAINER:/etc/caddy/Caddyfile"
docker exec "$CADDY_CONTAINER" caddy fmt --overwrite /etc/caddy/Caddyfile || { restore; exit 1; }
docker exec "$CADDY_CONTAINER" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile || { restore; exit 1; }
docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || { restore; exit 1; }
FIRST_NET="$(head -n 1 /work/caddy.networks)"
docker run --rm --network "$FIRST_NET" curlimages/curl:8.11.1 -fsS "http://${APP_CONTAINER}:${APP_PORT}/readyz" | grep -q '"ok":true' || { restore; exit 1; }
echo "$BACKUP" > /backups/LAST_CHEFSAPIENS_RC2_HML_BACKUP
echo "HML_RC2_CONFIGURE_OK"
echo "BACKUP=${BACKUP}"
