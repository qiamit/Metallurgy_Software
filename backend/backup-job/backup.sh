#!/usr/bin/env bash
# Nightly backup (Railway cron, 02:00 IST): Postgres dump + copy of every stored file,
# into a separate backup bucket. Old dumps are pruned after BACKUP_RETENTION_DAYS.
#
# Required env:
#   DATABASE_URL                       Railway Postgres (as postgres)
#   SOURCE_S3_ENDPOINT / SOURCE_S3_BUCKET / SOURCE_S3_ACCESS_KEY / SOURCE_S3_SECRET_KEY   media bucket
#   BACKUP_S3_ENDPOINT / BACKUP_S3_BUCKET / BACKUP_S3_ACCESS_KEY / BACKUP_S3_SECRET_KEY   backup bucket
# Optional: BACKUP_RETENTION_DAYS (default 30)
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export RCLONE_CONFIG_BACKUP_TYPE=s3
export RCLONE_CONFIG_BACKUP_PROVIDER=Other
export RCLONE_CONFIG_BACKUP_ENDPOINT="${BACKUP_S3_ENDPOINT:?}"
export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY:?}"
export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY:?}"
export RCLONE_CONFIG_BACKUP_REGION=auto

echo "[backup] dumping database"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$WORK/db.dump"
pg_restore --list "$WORK/db.dump" > /dev/null   # fail now if the dump is unreadable
SIZE="$(du -h "$WORK/db.dump" | cut -f1)"

echo "[backup] uploading db/${STAMP}.dump (${SIZE})"
rclone copyto "$WORK/db.dump" "backup:${BACKUP_S3_BUCKET}/db/${STAMP}.dump" --s3-no-check-bucket

if [[ -n "${SOURCE_S3_BUCKET:-}" ]]; then
  export RCLONE_CONFIG_SOURCE_TYPE=s3
  export RCLONE_CONFIG_SOURCE_PROVIDER=Other
  export RCLONE_CONFIG_SOURCE_ENDPOINT="${SOURCE_S3_ENDPOINT:?}"
  export RCLONE_CONFIG_SOURCE_ACCESS_KEY_ID="${SOURCE_S3_ACCESS_KEY:?}"
  export RCLONE_CONFIG_SOURCE_SECRET_ACCESS_KEY="${SOURCE_S3_SECRET_KEY:?}"
  export RCLONE_CONFIG_SOURCE_REGION=auto
  echo "[backup] copying stored files (images, overlays, branding)"
  # copy (not sync): a file deleted in the app stays in the backup.
  rclone copy "source:${SOURCE_S3_BUCKET}" "backup:${BACKUP_S3_BUCKET}/files" --s3-no-check-bucket --transfers 8
fi

echo "[backup] pruning database dumps older than ${RETENTION_DAYS} days"
rclone delete "backup:${BACKUP_S3_BUCKET}/db" --min-age "${RETENTION_DAYS}d" --s3-no-check-bucket

echo "[backup] done ${STAMP}"
