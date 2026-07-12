#!/bin/sh
set -eu

CADDY_CONTAINER="${CADDY_CONTAINER:-media-studio-caddy}"

BACKUP="${BACKUP_FILE:-}"
if [ -z "$BACKUP" ] && [ -f /backups/LAST_CHEFSAPIENS_RC3_HML_BACKUP ]; then
  BACKUP="$(cat /backups/LAST_CHEFSAPIENS_RC3_HML_BACKUP)"
fi

[ -n "$BACKUP" ] || { echo "RC3_ROLLBACK_NO_BACKUP"; exit 1; }
[ -f "$BACKUP" ] || { echo "RC3_ROLLBACK_BACKUP_MISSING=${BACKUP}"; exit 1; }

docker inspect "$CADDY_CONTAINER" >/dev/null
docker cp "$BACKUP" "$CADDY_CONTAINER:/etc/caddy/Caddyfile"
docker exec "$CADDY_CONTAINER" caddy fmt --overwrite /etc/caddy/Caddyfile
docker exec "$CADDY_CONTAINER" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
echo "RC3_ROLLBACK_OK=${BACKUP}"
