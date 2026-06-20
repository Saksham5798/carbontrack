#!/bin/bash
# ============================================================
# CarbonTrack - Deployment Script
# ============================================================

APP_DIR="/opt/carbontrack"
GIT_REPO="https://github.com/yourusername/carbontrack.git" # Replace with actual repo

echo "========================================"
echo "Starting Deployment Process..."
echo "========================================"

# Step 1: Ensure directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "Directory $APP_DIR does not exist. Cloning repository..."
    git clone $GIT_REPO $APP_DIR
fi

cd $APP_DIR || exit

# Step 2: Pull latest changes
echo "Pulling latest code from main branch..."
git fetch origin main
git pull origin main

# Step 3: Rebuild and Restart Docker Containers
echo "Rebuilding and restarting Docker containers..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Step 4: Verify services are running
echo "Verifying services..."
docker ps --filter "name=carbontrack"

echo "========================================"
echo "Deployment Completed Successfully!"
echo "========================================"
