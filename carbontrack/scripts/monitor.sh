#!/bin/bash
# ============================================================
# CarbonTrack - Basic Server Monitoring Script
# ============================================================

# Thresholds
CPU_THRESHOLD=80
MEM_THRESHOLD=75
DISK_THRESHOLD=85

echo "========================================"
echo "CarbonTrack Server Health Check"
echo "$(date)"
echo "========================================"

# Check CPU Usage
# Using top to get CPU idle percentage and calculating usage
CPU_IDLE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
CPU_USAGE=$(printf "%.0f" "$CPU_IDLE")

echo "CPU Usage: ${CPU_USAGE}%"
if [ "$CPU_USAGE" -gt "$CPU_THRESHOLD" ]; then
    echo "⚠️ ALERT: CPU utilization is above threshold (${CPU_THRESHOLD}%)!"
fi

# Check Memory Usage
MEM_INFO=$(free -m | grep Mem)
MEM_TOTAL=$(echo "$MEM_INFO" | awk '{print $2}')
MEM_USED=$(echo "$MEM_INFO" | awk '{print $3}')
MEM_USAGE=$(( 100 * MEM_USED / MEM_TOTAL ))

echo "Memory Usage: ${MEM_USAGE}% (${MEM_USED}MB / ${MEM_TOTAL}MB)"
if [ "$MEM_USAGE" -gt "$MEM_THRESHOLD" ]; then
    echo "⚠️ ALERT: Memory usage is above threshold (${MEM_THRESHOLD}%)!"
fi

# Check Disk Usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
echo "Disk Usage (/): ${DISK_USAGE}%"
if [ "$DISK_USAGE" -gt "$DISK_THRESHOLD" ]; then
    echo "⚠️ ALERT: Disk usage is above threshold (${DISK_THRESHOLD}%)!"
fi

echo "========================================"
# Check Docker Containers
echo "Docker Containers Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "========================================"
