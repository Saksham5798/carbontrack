# CarbonTrack Project - Complete Explanation Guide

---

## 1. Project Overview

CarbonTrack is a **cloud-based emissions monitoring platform** designed to help organizations track, manage, and report their greenhouse gas (GHG) emissions. This is a B.Tech Semester IV project that demonstrates modern full-stack development, cloud infrastructure, and DevOps practices.

**Key Objectives:**
- Centralize emissions data from multiple facilities
- Provide role-based access control (Staff, Manager, Admin)
- Generate compliance reports and real-time analytics
- Deploy on AWS with Docker containerization

---

## 2. Architecture Diagram & Components

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Browser                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (Port 443)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy (Frontend)              │
│  - Serves static HTML/CSS/JS files                              │
│  - Proxies API requests to Flask backend                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Flask Backend (Port 5000)                     │
│  - REST API endpoints                                           │
│  - JWT Authentication                                           │
│  - Role-based access control                                    │
│  - Business logic for emissions, reports, workflows             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MySQL Database (Port 3306)                    │
│  - Users, Facilities, Emission Records, Tasks, Reports          │
│  - Persistent storage via Docker volume                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack Breakdown

### 3.1 Frontend
- **HTML5**: Structure of the web app
- **CSS3**: Custom styling with variables and responsive design
- **JavaScript (Vanilla JS)**: Single-page application logic
- **Chart.js**: Data visualization for dashboards
- **Bootstrap 5**: UI components and responsive grid
- **Nginx**: Web server to serve static files and reverse proxy

### 3.2 Backend
- **Python 3.10**: Programming language
- **Flask**: Lightweight web framework
- **Flask-SQLAlchemy**: ORM (Object-Relational Mapper) for database interactions
- **Flask-JWT-Extended**: JWT (JSON Web Token) authentication
- **Flask-CORS**: Cross-Origin Resource Sharing support
- **PyMySQL**: MySQL database driver
- **Gunicorn**: Production WSGI server
- **python-dotenv**: Environment variable management

### 3.3 Database
- **MySQL 8.0**: Relational database management system
- **Schema**: 5 tables + 2 views + stored procedure

### 3.4 DevOps & Cloud
- **Docker**: Containerization of all services
- **Docker Compose**: Orchestration of multi-container app
- **AWS EC2**: Virtual server for hosting
- **AWS S3**: Backup storage
- **AWS CloudWatch**: Monitoring and logging
- **AWS IAM**: Identity and access management
- **Ubuntu 22.04 LTS**: Server OS

---

## 4. Database Schema Explained

### 4.1 Tables

#### 1. `users`
Stores user accounts and authentication data.
- `id`: Primary key (auto-increment)
- `name`, `email`, `password_hash`: User credentials
- `role`: ENUM ('admin', 'manager', 'staff') - role-based access
- `department`, `is_active`, `last_login`: Additional user info

#### 2. `facilities`
Stores information about facilities/sites emitting GHGs.
- `facility_id`: Primary key
- `facility_name`, `region`, `location`: Facility details
- `facility_type`: ENUM ('manufacturing', 'power_plant', etc.)
- `capacity_mw`, `operational_since`: Operational details

#### 3. `emission_records`
Core table storing emissions data.
- `record_id`: Primary key
- `facility_id`: Foreign key to facilities
- `co2_emissions`, `methane_emissions`: GHG values in metric tons
- `total_co2e`: CO₂ equivalent (CO₂ + Methane * 25 - GWP factor)
- `emission_date`: Date of measurement
- `status`: ENUM ('pending', 'under_review', 'approved', 'rejected')
- `submitted_by`, `notes`: Audit trail

#### 4. `tasks`
Workflow management for approval processes.
- `task_id`: Primary key
- `assigned_to`, `assigned_by`: Foreign keys to users
- `title`, `description`, `priority`, `approval_status`: Task details
- `record_id`: Links task to specific emission record

#### 5. `reports`
Logs generated reports.
- `report_id`: Primary key
- `report_type`: ENUM ('monthly', 'quarterly', etc.)
- `from_date`, `to_date`, `region_filter`: Report parameters
- `total_records`, `generated_by`, `generated_date`: Metadata

#### 6. `audit_logs`
Security audit trail (tracks who did what when).

### 4.2 Views
- `v_emission_summary`: Aggregates emissions by facility/region
- `v_compliance_status`: Shows compliance percentage

### 4.3 Stored Procedures
- `sp_monthly_compliance`: Generates monthly compliance report

---

## 5. Backend API Endpoints

### Authentication (`/api/auth`)
- `POST /login`: User login (returns JWT token)
- `GET /users`: Get all users (requires auth)
- `POST /register`: Create new user (requires auth)

### Emissions (`/api/emissions`)
- `GET /`: List all emission records
- `POST /`: Create new emission record (requires auth)
- `PUT /:id`: Update record (requires auth)
- `DELETE /:id`: Delete record (requires auth)
- `GET /stats/summary`: Get dashboard stats

### Facilities (`/api/facilities`)
- `GET /`: List all facilities
- `POST /`: Create facility (requires auth)

### Workflow (`/api/workflow`)
- `GET /tasks`: List tasks
- `POST /tasks`: Create task (requires auth)
- `PUT /tasks/:id/status`: Update task status (requires auth)
- `GET /pending-approvals`: Count pending approvals

### Reports (`/api/reports`)
- `GET /`: List reports
- `POST /generate`: Generate report (requires auth)

---

## 6. Role-Based Access Control (RBAC)

| Role     | Permissions                                                                 |
|----------|-----------------------------------------------------------------------------|
| **Admin**| Full access: Manage users, facilities, records, tasks, reports              |
| **Manager**| Approve/reject records, manage tasks, view reports                        |
| **Staff**| Create emission records, view own tasks, read-only access to reports       |

---

## 7. Docker & Containerization Explained

### 7.1 Why Docker?
- **Consistency**: Same environment everywhere (dev → test → prod)
- **Isolation**: Each service runs in its own container
- **Portability**: Run anywhere Docker is installed (local, EC2, etc.)
- **Scalability**: Easy to scale services independently

### 7.2 Docker Services (`docker-compose.yml`)

1. **frontend**: Nginx container serving static files
2. **backend**: Flask + Gunicorn container for API
3. **database**: MySQL container with persistent storage

### 7.3 Dockerfile for Backend
```dockerfile
FROM python:3.10-slim          # Base image
WORKDIR /app                  # Working directory
RUN apt-get update && apt-get install -y default-libmysqlclient-dev build-essential  # Install system dependencies
COPY requirements.txt .       # Copy dependencies
RUN pip install --no-cache-dir -r requirements.txt  # Install Python packages
COPY . .                      # Copy app code
EXPOSE 5000                   # Expose port
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "app:app"]  # Start server
```

---

## 8. AWS Deployment Architecture

### 8.1 Key AWS Services Used

1. **Amazon EC2**: Virtual server to host the Docker containers
2. **Amazon VPC**: Isolated network for EC2
3. **Amazon S3**: Stores database backups
4. **Amazon CloudWatch**: Monitors CPU, memory, disk, logs
5. **AWS IAM**: Controls access to AWS resources
6. **Security Groups**: Firewall for EC2 (controls inbound/outbound traffic)

### 8.2 Security Best Practices
- Restrict SSH access to your IP only
- Don't expose MySQL port publicly
- Use IAM roles instead of hardcoding credentials
- Use HTTPS with Let's Encrypt certificates
- Regular database backups to S3

---

## 9. Automation Scripts

### `backup.sh`
- Dumps MySQL database
- Compresses it
- Uploads to S3
- Cleans up temporary files

### `deploy.sh`
- Pulls latest code from Git
- Rebuilds Docker containers
- Restarts services

### `maintenance.sh`
- Cleans up unused Docker resources
- Rotates old logs
- Frees up disk space

### `monitor.sh`
- Checks CPU, memory, disk usage
- Sends alerts if thresholds are exceeded

---

## 10. How the App Works (Step-by-Step Flow)

### Example 1: Creating an Emission Record
1. **Staff User** logs in with credentials
2. Frontend sends `POST /api/auth/login` with email/password
3. Backend verifies credentials, returns JWT token
4. Frontend stores token in localStorage
5. Staff fills out "Add Emission" form
6. Frontend sends `POST /api/emissions` with data + JWT token
7. Backend validates token, saves record to DB (status: pending)
8. Frontend refreshes records list

### Example 2: Approving a Record
1. **Manager** views pending tasks
2. Manager clicks "Approve" on a task
3. Frontend sends `PUT /api/workflow/tasks/:id/status`
4. Backend updates task status to "approved"
5. Backend updates linked emission record status to "approved"
6. Dashboard stats are updated automatically

---

## 11. Pricing (Free Tier Eligible)

This project is perfect for AWS Free Tier!

| Service          | Free Tier Usage                          | Cost (Free Tier) |
|------------------|------------------------------------------|-----------------|
| EC2 t2.micro     | 750 hours/month                          | $0.00           |
| S3               | 5GB storage                              | ~$0.15/month    |
| CloudWatch       | Basic metrics + 10 custom metrics        | $0.00           |
| EBS Storage      | 30GB                                     | $0.00           |
| **Total**        |                                          | **~$0.15/month**|

---

## 12. Key Concepts Demonstrated

- **Full-Stack Development**: Frontend (JS/HTML/CSS) + Backend (Flask) + Database (MySQL)
- **RESTful API Design**: Standard HTTP methods (GET, POST, PUT, DELETE)
- **JWT Authentication**: Stateless token-based auth
- **ORM (SQLAlchemy)**: Object-oriented database access
- **Docker Containerization**: Package app with dependencies
- **Docker Compose**: Multi-container orchestration
- **Cloud Infrastructure (AWS)**: EC2, S3, CloudWatch, IAM
- **DevOps Practices**: Automation scripts, backups, monitoring
- **Role-Based Access Control (RBAC)**: Granular permissions
- **Data Visualization**: Charts for analytics

---

## 13. Troubleshooting Common Issues

### Problem: Containers won't start
- Check `docker-compose logs` for errors
- Make sure ports 80, 5000, 3306 are not in use
- Verify database credentials in `docker-compose.yml`

### Problem: Can't connect to backend API
- Check if backend container is running: `docker ps`
- Verify Nginx config is proxying correctly
- Check CORS settings in Flask app

### Problem: Database data lost on restart
- Make sure the `db_data` volume is defined in `docker-compose.yml`
- Don't run `docker-compose down -v` (removes volumes!)

---

## 14. Future Enhancements (Optional)

1. **Migrate to AWS RDS**: Managed MySQL instead of container
2. **CI/CD Pipeline**: GitHub Actions or AWS CodePipeline
3. **Serverless**: Refactor backend to AWS Lambda + API Gateway
4. **IoT Integration**: Ingest real-time data from sensors
5. **Email Notifications**: Send alerts for pending approvals
6. **Advanced Analytics**: Machine learning for emission forecasting
7. **Multi-AZ Deployment**: High availability across AWS AZs

---

## 15. Summary

Congratulations! You now have a complete, production-ready cloud-native application that demonstrates:
- Modern full-stack development
- Cloud infrastructure on AWS
- Docker containerization and DevOps
- Database design and management
- Security best practices
- Monitoring and automation

This project is excellent for your B.Tech Semester IV portfolio and shows practical, real-world skills!

AWS → Amazon Web Services
EC2 → Elastic Compute Cloud
S3 → Simple Storage Service
VPC → Virtual Private Cloud
IAM → Identity and Access Management
RDS → Relational Database Service
EBS → Elastic Block Store
SNS → Simple Notification Service
SQS → Simple Queue Service
EFS → Elastic File System
ECS → Elastic Container Service
EKS → Elastic Kubernetes Service
AMI → Amazon Machine Image
AZ → Availability Zone
ARN → Amazon Resource Name
NAT → Network Address Translation
CIDR → Classless Inter-Domain Routing
WAF → Web Application Firewall
KMS → Key Management Service
ACM → AWS Certificate Manager