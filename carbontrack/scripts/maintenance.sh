#!/bin/bash
# ============================================================
# CarbonTrack - System Maintenance & Cleanup Script
# ============================================================

echo "========================================"
echo "Starting System Maintenance..."
echo "========================================"

# 1. Clean up unused Docker images, containers, and networks
echo "Cleaning up unused Docker resources..."
docker system prune -af --volumes

# 2. Clear old application logs (keep last 5 days)
LOG_DIR="/opt/carbontrack/backend/logs"
if [ -d "$LOG_DIR" ]; then
    echo "Cleaning up application logs older than 5 days..."
    find "$LOG_DIR" -type f -name "*.log*" -mtime +5 -exec rm {} \;
fi

# 3. Clear system journal logs (keep last 200MB)
echo "Rotating system journal logs..."
journalctl --vacuum-size=200M

# 4. Clear apt cache
echo "Cleaning APT cache..."
apt-get clean
apt-get autoremove -y

echo "========================================"
echo "Maintenance Completed Successfully."
echo "========================================"
