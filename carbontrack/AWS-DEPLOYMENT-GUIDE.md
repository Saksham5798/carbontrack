# CarbonTrack Complete AWS Deployment Guide

## Prerequisites
- Active AWS Account
- SSH Key Pair (created in AWS)
- Domain name (optional, for HTTPS)

---

## Step 1: Launch EC2 Instance

1. **Go to AWS EC2 Console**
2. **Launch Instance**:
   - Name: `carbontrack-server`
   - AMI: Ubuntu 22.04 LTS (HVM)
   - Instance Type: `t2.micro` (Free Tier eligible)
3. **Key Pair**: Select existing or create new key pair (save `.pem` file securely!)
4. **Network Settings**:
   - Create Security Group:
     - SSH (Port 22) – Restrict to your IP
     - HTTP (Port 80) – 0.0.0.0/0
     - HTTPS (Port 443) – 0.0.0.0/0
5. **Storage**: 30GB gp2 (Free Tier)
6. **Launch Instance**

---

## Step 2: Connect to EC2 Instance

```bash
# On your local machine, make .pem file private
chmod 400 carbontrack-key.pem

# SSH into the server
ssh -i carbontrack-key.pem ubuntu@<YOUR-EC2-PUBLIC-IP>
```

---

## Step 3: Install Docker and Docker Compose

Run these commands on the EC2 instance:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose -y

# Logout and log back in for changes to take effect
exit

# SSH again to verify
ssh -i carbontrack-key.pem ubuntu@<YOUR-EC2-PUBLIC-IP>
docker --version
docker-compose --version
```

---

## Step 4: Deploy CarbonTrack

```bash
# Clone or copy project files to /opt/carbontrack
sudo mkdir -p /opt/carbontrack
cd /opt/carbontrack

# Option 1: Clone from Git (if you pushed to a repo)
# git clone <your-repo-url> .

# Option 2: Copy from local machine using SCP (run on your local machine)
# scp -i carbontrack-key.pem -r "carbontrack" ubuntu@<YOUR-EC2-PUBLIC-IP>:/opt/

# Set permissions
sudo chown -R ubuntu:ubuntu /opt/carbontrack
chmod +x /opt/carbontrack/scripts/*.sh

# Start the application
cd /opt/carbontrack
docker-compose up -d --build

# Check running containers
docker ps
```

---

## Step 5: Configure HTTPS with Let's Encrypt (Optional but Recommended)

First, point your domain to the EC2 Public IP in DNS settings. Then:

```bash
# Install Certbot
sudo apt install certbot -y

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Update Nginx config to use SSL (see frontend/nginx.conf for example)
# Then restart containers
docker-compose restart
```

---

## Step 6: Set Up Automated Backups

```bash
# Create S3 Bucket for backups via AWS Console

# Install AWS CLI
sudo apt install awscli -y

# Configure AWS CLI (use IAM role or access keys)
aws configure

# Test backup script
/opt/carbontrack/scripts/backup.sh

# Add cron job for daily backup at 2 AM
crontab -e
# Add this line:
0 2 * * * /opt/carbontrack/scripts/backup.sh >> /var/log/carbontrack-backup.log 2>&1
```

---

## Step 7: Install CloudWatch Agent (Optional)

```bash
# Download and install CloudWatch Agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

# Start agent
sudo systemctl start amazon-cloudwatch-agent
sudo systemctl enable amazon-cloudwatch-agent
```

---

## Access Your Application
- **HTTP**: `http://<YOUR-EC2-PUBLIC-IP>`
- **HTTPS**: `https://your-domain.com` (if configured)

---

## Demo Credentials
- Admin: admin@carbontrack.com / Admin@123
- Manager: manager@carbontrack.com / Admin@123
- Staff: staff@carbontrack.com / Admin@123
