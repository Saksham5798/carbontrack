# CarbonTrack Emissions Monitoring Cloud – AWS Case Study

## 1. Problem Statement
Many manufacturing and energy companies struggle to accurately monitor, report, and maintain compliance for their greenhouse gas (GHG) emissions (such as CO₂ and Methane). Data is often siloed in spreadsheets, leading to errors, delayed compliance reporting, and lack of visibility for executives. There is a need for a centralized, cloud-hosted platform to securely record emissions, manage approval workflows, and generate analytics.

## 2. Proposed Solution
**CarbonTrack** is a cloud-native web application built to address these challenges. It provides a centralized database for recording emissions from multiple facilities across different regions. It features a robust role-based access control (RBAC) system for Staff (data entry), Managers (approval), and Admins (system oversight). The platform generates real-time analytics and compliance reports, ensuring businesses meet environmental regulations. The application is containerized using Docker and deployed on AWS for scalability and reliability.

## 3. Architecture Diagram

```text
                                +---------------------------------------------------+
                                |                   AWS Cloud                       |
                                |                                                   |
+---------+      HTTPS (443)    |  +---------------------------------------------+  |
|         | ------------------> |  | VPC (10.0.0.0/16)                           |  |
|  User   |                     |  |                                             |  |
| Browser | <------------------ |  |  +---------------------------------------+  |  |
|         |                     |  |  | Public Subnet (10.0.1.0/24)           |  |  |
+---------+                     |  |  |                                       |  |  |
                                |  |  |  +---------------------------------+  |  |  |
                                |  |  |  | EC2 Instance (t2.micro)         |  |  |  |
                                |  |  |  | (Security Group: 80, 443, 22)   |  |  |  |
                                |  |  |  |                                 |  |  |  |
                                |  |  |  |  [Docker Compose]               |  |  |  |
                                |  |  |  |   - Frontend (Nginx) :80        |  |  |  |
                                |  |  |  |   - Backend (Node.js) :3000     |  |  |  |
                                |  |  |  |   - Database (MySQL) :3306      |  |  |  |
                                |  |  |  +---------------------------------+  |  |  |
                                |  |  +---------------------------------------+  |  |
                                |  |        |                                    |  |
                                |  |        v                                    |  |
                                |  |    Internet Gateway (IGW)                   |  |
                                |  +---------------------------------------------+  |
                                |                                                   |
                                |   +----------------+       +------------------+   |
                                |   | Amazon S3      |       | Amazon CloudWatch|   |
                                |   | (Backups,      |       | (Monitoring,     |   |
                                |   |  Reports)      |       |  Logs)           |   |
                                |   +----------------+       +------------------+   |
                                +---------------------------------------------------+
```

## 4. AWS Services Used
*   **Amazon EC2 (Elastic Compute Cloud):** Hosts the Dockerized frontend, backend, and database.
*   **Amazon VPC (Virtual Private Cloud):** Provides a logically isolated network for the EC2 instance.
*   **Amazon S3 (Simple Storage Service):** Used for storing automated database backups and generated compliance reports.
*   **Amazon CloudWatch:** Monitors EC2 metrics (CPU, Memory, Disk) and application logs.
*   **AWS IAM (Identity and Access Management):** Manages secure access for the EC2 instance to upload backups to S3.

## 5. VPC Network Diagram
*   **VPC CIDR:** `10.0.0.0/16`
*   **Public Subnet:** `10.0.1.0/24` (Hosts EC2 instance)
*   **Internet Gateway:** Attached to VPC to allow internet access.
*   **Route Table:** Directs traffic from the Public Subnet `0.0.0.0/0` to the Internet Gateway.
*   **Security Group Rules (Inbound):**
    *   Port 22 (SSH) - Restricted to admin IP
    *   Port 80 (HTTP) - Open to `0.0.0.0/0`
    *   Port 443 (HTTPS) - Open to `0.0.0.0/0`
    *   Port 3306 (MySQL) - Restricted (Accessible only internally within the Docker network)

## 6. Database Schema
The MySQL database consists of five primary tables:
*   **users:** Stores user credentials and role-based access levels (admin, manager, staff).
*   **facilities:** Contains operational sites, locations, and capacity.
*   **emission_records:** Core table storing daily/monthly CO₂ and Methane (CH₄) metrics, linked to facilities.
*   **tasks:** Manages workflow approval status for submitted emission records.
*   **reports:** Logs generated reports and their metadata.
*   *(Detailed schema provided in `database/schema.sql`)*

## 7. Docker Architecture
The application is containerized using `docker-compose.yml`, which spins up three services:
1.  **frontend:** Built using an `nginx:alpine` image to serve static HTML/CSS/JS.
2.  **backend:** Built using a `node:18-alpine` image running Express.js to provide API endpoints.
3.  **database:** Built using a `mysql:8.0` image, initialized with `schema.sql`, and utilizing a persistent Docker volume (`db_data`) to prevent data loss upon container restart.

## 8. Linux Administration Commands
Key Linux commands utilized for server management:
*   **User Management:** `sudo adduser devops`, `sudo usermod -aG docker devops`
*   **Permissions:** `sudo chown -R devops:devops /opt/carbontrack`, `chmod +x /opt/carbontrack/scripts/*.sh`
*   **Package Management:** `sudo apt update`, `sudo apt install docker.io docker-compose git nginx -y`
*   **Process Monitoring:** `top`, `htop`, `docker stats`
*   **Service Management:** `sudo systemctl enable docker`, `sudo systemctl status docker`
*   **Logs:** `journalctl -u docker`, `tail -f /var/log/syslog`

## 9. Deployment Steps
1.  Launch an AWS EC2 instance (Ubuntu 22.04 LTS).
2.  Configure Security Group to allow SSH (22) and HTTP/HTTPS (80/443).
3.  SSH into the server: `ssh -i key.pem ubuntu@<Public-IP>`
4.  Install Docker and Git.
5.  Clone the repository: `git clone <repo-url> /opt/carbontrack`
6.  Navigate to the directory: `cd /opt/carbontrack`
7.  Run deployment: `sudo docker-compose up -d --build`
8.  Access the application via the EC2 Public IP in a browser.

## 10. Monitoring Configuration
*   **AWS CloudWatch:** A CloudWatch Agent can be installed on the EC2 instance to push custom metrics (Memory, Disk Usage) which are not tracked by default.
*   **Local Monitoring Script:** The provided `scripts/monitor.sh` script continuously checks CPU (>80%), Memory (>75%), and Disk (>85%) limits and outputs alerts.

## 11. Shell Scripts
Located in the `scripts/` folder:
*   `backup.sh`: Dumps the MySQL database and uploads the archive to an Amazon S3 bucket.
*   `deploy.sh`: Pulls the latest code from GitHub and restarts the Docker containers.
*   `maintenance.sh`: Cleans up unused Docker images and old log files to prevent disk exhaustion.
*   `monitor.sh`: Checks system resource utilization.

## 12. IAM and Security Configuration
*   **IAM Role for EC2:** Create a role with an inline policy granting `s3:PutObject` access to the specific backup S3 bucket. Attach this role to the EC2 instance so `backup.sh` can run without hardcoded AWS credentials.
*   **Least Privilege:** Security groups only expose necessary ports. The database port (3306) is not exposed to the public internet, only to the Docker backend container.

## 13. Backup and Disaster Recovery
*   **Strategy:** Daily automated backups of the MySQL database are triggered via a Linux `cron` job (`0 2 * * * /opt/carbontrack/scripts/backup.sh`).
*   **Storage:** Backups are compressed (`.sql.gz`) and securely transferred to Amazon S3.
*   **Recovery:** In a disaster scenario, a new EC2 instance can be spun up, the code pulled via `deploy.sh`, and the latest SQL dump downloaded from S3 and restored into the new MySQL container.

## 14. Pricing Analysis (Monthly Estimate)

| AWS Service | Specification / Usage | Basic Tier (Dev) | Standard Tier (Prod) | High Availability (Enterprise) |
| :--- | :--- | :--- | :--- | :--- |
| **Amazon EC2** | Compute instances | t2.micro (Free Tier) - $0.00 | t3.small - $15.00 | 2x t3.medium + ALB - $100.00 |
| **Amazon EBS** | Block Storage | 30GB gp2 (Free Tier) - $0.00 | 50GB gp3 - $4.00 | 100GB gp3 - $8.00 |
| **Amazon RDS** | Managed Database | Local MySQL in EC2 - $0.00 | db.t3.micro (Single-AZ) - $15.00 | db.t3.small (Multi-AZ) - $60.00 |
| **Amazon S3** | Backups & Reports | 5GB Standard - ~$0.15 | 50GB Standard - ~$1.15 | 500GB Standard - ~$11.50 |
| **CloudWatch** | Monitoring | Basic (Free) - $0.00 | Custom Metrics - ~$3.00 | Custom + Logs Insight - ~$15.00 |
| **Data Transfer**| Outbound bandwidth | <100GB (Free Tier) - $0.00 | 500GB - ~$45.00 | 2TB - ~$180.00 |
| **Total (Est.)** | | **~$0.15 / month** | **~$83.15 / month** | **~$374.50 / month** |

*Note: The Basic Tier utilizes AWS Free Tier limits which is ideal for this Semester IV case study project.*

## 15. Future Enhancements
*   **Migrate to Managed Services:** Move the local MySQL container to Amazon RDS for automated backups and Multi-AZ deployments.
*   **Serverless Migration:** Refactor backend Express routes into AWS Lambda functions utilizing API Gateway.
*   **CI/CD Pipeline:** Implement GitHub Actions or AWS CodePipeline to automate the `deploy.sh` script upon code commits.
*   **IoT Integration:** Connect live IoT sensors from facilities directly to AWS IoT Core to automatically ingest real-time emission data without manual data entry.

## 16. Conclusion
The CarbonTrack Emissions Monitoring Cloud successfully demonstrates the integration of modern web development (Node.js, Express, HTML/CSS/JS) with cloud infrastructure (AWS) and DevOps practices (Docker, Shell Scripting, Linux Administration). It fulfills all case study requirements by providing a realistic, functional application architecture suitable for deployment while maintaining security, automation, and cost-efficiency.
