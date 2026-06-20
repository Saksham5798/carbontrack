#!/bin/bash
# ============================================================
# CarbonTrack - Automated Backup Script to AWS S3
# ============================================================

# Configuration
DB_CONTAINER="carbontrack-db"
DB_USER="root"
DB_PASS="RootPassword@123"
DB_NAME="carbontrack_db"
S3_BUCKET="s3://carbontrack-backups-bucket"
BACKUP_DIR="/tmp/carbontrack_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"

echo "========================================"
echo "Starting Database Backup - ${TIMESTAMP}"
echo "========================================"

# Create temporary backup directory
mkdir -p "$BACKUP_DIR"

# Step 1: Dump database from Docker container and compress it
echo "[1/3] Dumping database from container ${DB_CONTAINER}..."
if docker exec "$DB_CONTAINER" /usr/bin/mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    echo "Database dump successful: ${BACKUP_FILE}"
else
    echo "ERROR: Database dump failed!"
    exit 1
fi

# Step 2: Upload to AWS S3
echo "[2/3] Uploading backup to S3 bucket ${S3_BUCKET}..."
# Requires AWS CLI to be installed and configured
if aws s3 cp "$BACKUP_FILE" "${S3_BUCKET}/db_backups/"; then
    echo "Upload to S3 successful!"
else
    echo "ERROR: Upload to S3 failed. Please check AWS CLI configuration."
    # We don't exit here so we can still clean up
fi

# Step 3: Cleanup local old backups
echo "[3/3] Cleaning up temporary files..."
rm -f "$BACKUP_FILE"
# Optional: Remove backups older than 7 days if keeping local copies
# find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -exec rm {} \;

echo "========================================"
echo "Backup Process Completed."
echo "========================================"
