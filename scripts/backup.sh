#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

stamp=$(date -u +%Y-%m-%dT%H%M)
out="backups/placement-$stamp.sql.gz"
mkdir -p backups

docker compose exec -T postgres sh -c 'pg_dumpall -U "${POSTGRES_USER:-postgres}"' \
  | gzip > "$out.tmp"
mv "$out.tmp" "$out"

gcloud storage cp "$out" "gs://$BACKUP_BUCKET/"
find backups -name '*.sql.gz' -mtime +7 -delete
echo "backup ok: $out"