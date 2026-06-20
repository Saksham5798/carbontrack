-- ============================================================
--  CarbonTrack Emissions Monitoring Cloud - Database Schema
--  Compatible with: MySQL 8.0+ / Amazon RDS MySQL
--  Database: carbontrack_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS carbontrack_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE carbontrack_db;

-- ────────────────────────────────────────────────────────────
-- TABLE: users
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name            VARCHAR(120)    NOT NULL,
  email           VARCHAR(180)    NOT NULL UNIQUE,
  password_hash   VARCHAR(255)    NOT NULL,
  role            ENUM('admin','manager','staff') NOT NULL DEFAULT 'staff',
  department      VARCHAR(100)    DEFAULT NULL,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  last_login      DATETIME        DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_users_email  (email),
  INDEX idx_users_role   (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- TABLE: facilities
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  facility_id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  facility_name       VARCHAR(200)  NOT NULL,
  region              VARCHAR(100)  NOT NULL,
  facility_type       ENUM('manufacturing','power_plant','refinery','warehouse','office','other') NOT NULL DEFAULT 'other',
  location            VARCHAR(255)  DEFAULT NULL,
  capacity_mw         DECIMAL(10,2) DEFAULT NULL,
  operational_since   DATE          DEFAULT NULL,
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (facility_id),
  INDEX idx_facilities_region (region),
  INDEX idx_facilities_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- TABLE: emission_records
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emission_records (
  record_id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  facility_id         INT UNSIGNED    NOT NULL,
  co2_emissions       DECIMAL(14,4)   NOT NULL DEFAULT 0.0000  COMMENT 'Metric Tons CO2',
  methane_emissions   DECIMAL(14,4)   NOT NULL DEFAULT 0.0000  COMMENT 'Metric Tons CH4',
  total_co2e          DECIMAL(14,4)   NOT NULL DEFAULT 0.0000  COMMENT 'CO2 Equivalent (GWP 25 for CH4)',
  emission_date       DATE            NOT NULL,
  status              ENUM('pending','under_review','approved','rejected') NOT NULL DEFAULT 'pending',
  notes               TEXT            DEFAULT NULL,
  submitted_by        INT UNSIGNED    DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (record_id),
  FOREIGN KEY fk_er_facility (facility_id)   REFERENCES facilities(facility_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY fk_er_user     (submitted_by)  REFERENCES users(id)               ON DELETE SET NULL  ON UPDATE CASCADE,
  INDEX idx_er_date     (emission_date),
  INDEX idx_er_status   (status),
  INDEX idx_er_facility (facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- TABLE: tasks  (Workflow Management)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  task_id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  assigned_to       INT UNSIGNED    NOT NULL,
  assigned_by       INT UNSIGNED    NOT NULL,
  record_id         INT UNSIGNED    DEFAULT NULL,
  title             VARCHAR(255)    NOT NULL,
  description       TEXT            DEFAULT NULL,
  priority          ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  approval_status   ENUM('pending','in_progress','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  comments          TEXT            DEFAULT NULL,
  approved_by       INT UNSIGNED    DEFAULT NULL,
  approved_at       DATETIME        DEFAULT NULL,
  due_date          DATE            DEFAULT NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id),
  FOREIGN KEY fk_task_assignee  (assigned_to) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY fk_task_assigner  (assigned_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY fk_task_approver  (approved_by) REFERENCES users(id) ON DELETE SET NULL  ON UPDATE CASCADE,
  FOREIGN KEY fk_task_record    (record_id)   REFERENCES emission_records(record_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_task_status   (approval_status),
  INDEX idx_task_assignee (assigned_to),
  INDEX idx_task_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- TABLE: reports
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  report_id       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  report_type     ENUM('monthly','quarterly','annual','regional','compliance','custom') NOT NULL,
  from_date       DATE            DEFAULT NULL,
  to_date         DATE            DEFAULT NULL,
  region_filter   VARCHAR(100)    DEFAULT NULL,
  file_name       VARCHAR(255)    DEFAULT NULL,
  s3_key          VARCHAR(500)    DEFAULT NULL,
  total_records   INT UNSIGNED    DEFAULT 0,
  report_data     LONGTEXT        DEFAULT NULL COMMENT 'JSON serialized report data',
  generated_by    INT UNSIGNED    DEFAULT NULL,
  generated_date  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  FOREIGN KEY fk_report_user (generated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_report_type (report_type),
  INDEX idx_report_date (generated_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
-- TABLE: audit_logs  (Security & Compliance)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED    DEFAULT NULL,
  action      VARCHAR(100)    NOT NULL,
  table_name  VARCHAR(100)    DEFAULT NULL,
  record_id   INT UNSIGNED    DEFAULT NULL,
  old_values  TEXT            DEFAULT NULL,
  new_values  TEXT            DEFAULT NULL,
  ip_address  VARCHAR(45)     DEFAULT NULL,
  user_agent  VARCHAR(500)    DEFAULT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  INDEX idx_audit_user   (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_date   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA - Default Users (Passwords: Admin@123, etc.)
-- bcrypt hash generated for: Admin@123
-- ============================================================

INSERT INTO users (name, email, password_hash, role, department) VALUES
  ('System Administrator', 'admin@carbontrack.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lFLW', 'admin',   'IT & Cloud Operations'),
  ('Regional Manager',     'manager@carbontrack.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lFLW', 'manager', 'Environmental Compliance'),
  ('Field Staff',          'staff@carbontrack.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lFLW', 'staff',   'Data Entry')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================
-- SEED DATA - Sample Facilities
-- ============================================================
INSERT INTO facilities (facility_name, region, facility_type, location, capacity_mw, operational_since) VALUES
  ('Mumbai Power Station Alpha',   'Mumbai',    'power_plant',    'Trombay, Mumbai, MH',          620.00, '2010-04-01'),
  ('Pune Industrial Complex',      'Pune',      'manufacturing',  'MIDC Bhosari, Pune, MH',        NULL,   '2008-08-15'),
  ('Delhi Refinery North',         'Delhi',     'refinery',       'Panipat Rd, Delhi NCR',         NULL,   '2005-01-10'),
  ('Bangalore Tech Campus',        'Bangalore', 'office',         'Electronic City, Bangalore, KA',NULL,   '2015-06-01'),
  ('Chennai Port Terminal',        'Chennai',   'warehouse',      'Ennore Port, Chennai, TN',      NULL,   '2012-11-20'),
  ('Kolkata Manufacturing Unit',   'Kolkata',   'manufacturing',  'Durgapur Industrial Zone, WB',  NULL,   '2003-03-05'),
  ('Hyderabad Chemical Plant',     'Hyderabad', 'manufacturing',  'Patancheru, Hyderabad, TS',     NULL,   '2007-09-12'),
  ('Ahmedabad Solar Farm',         'Ahmedabad', 'power_plant',    'Gandhinagar Solar Park, GJ',   150.00, '2019-02-28')
ON DUPLICATE KEY UPDATE facility_name = VALUES(facility_name);

-- ============================================================
-- SEED DATA - Sample Emission Records (last 6 months)
-- ============================================================
INSERT INTO emission_records (facility_id, co2_emissions, methane_emissions, total_co2e, emission_date, status, notes, submitted_by) VALUES
  (1, 1250.50, 45.20, 2380.50, DATE_SUB(CURDATE(), INTERVAL 180 DAY), 'approved',     'Q1 reporting - verified', 3),
  (2, 876.30,  32.10, 1676.80, DATE_SUB(CURDATE(), INTERVAL 150 DAY), 'approved',     'Manufacturing line A+B',  3),
  (3, 2100.00, 87.50, 4287.50, DATE_SUB(CURDATE(), INTERVAL 120 DAY), 'approved',     'Refinery monthly report', 3),
  (4,  45.20,   2.10,   97.70, DATE_SUB(CURDATE(), INTERVAL 120 DAY), 'approved',     'Office HVAC + generators',3),
  (5, 320.80,  15.60,  711.80, DATE_SUB(CURDATE(), INTERVAL 90 DAY),  'approved',     'Port operations Q2',      3),
  (6, 985.60,  41.20, 2015.60, DATE_SUB(CURDATE(), INTERVAL 90 DAY),  'under_review', 'Pending audit review',    3),
  (7, 1560.00, 62.40, 3120.00, DATE_SUB(CURDATE(), INTERVAL 60 DAY),  'approved',     'Chemical plant July',     3),
  (1, 1180.40, 43.80, 2275.40, DATE_SUB(CURDATE(), INTERVAL 60 DAY),  'approved',     'Monthly submission',      3),
  (2, 910.20,  35.50, 1797.70, DATE_SUB(CURDATE(), INTERVAL 30 DAY),  'pending',      'Awaiting manager review', 3),
  (3, 2250.00, 91.00, 4525.00, DATE_SUB(CURDATE(), INTERVAL 30 DAY),  'pending',      'Latest monthly data',     3),
  (8,  12.50,   0.50,   25.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY),  'approved',     'Solar facility - minimal', 3),
  (5, 298.60,  14.20,  653.60, DATE_SUB(CURDATE(), INTERVAL 10 DAY),  'pending',      'Current month report',    3)
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ============================================================
-- SEED DATA - Sample Tasks
-- ============================================================
INSERT INTO tasks (assigned_to, assigned_by, record_id, title, description, priority, approval_status, due_date) VALUES
  (3, 2, 6,  'Review Mumbai Q2 Report',  'Audit and approve Q2 emission data for Mumbai Power Station', 'high',   'pending',     DATE_ADD(CURDATE(), INTERVAL 3 DAY)),
  (3, 2, 9,  'Verify Pune Monthly Data', 'Cross-check sensor readings against submitted figures',        'medium', 'in_progress', DATE_ADD(CURDATE(), INTERVAL 7 DAY)),
  (3, 1, 10, 'Delhi Refinery Audit',     'Conduct full compliance audit for Delhi refinery Q3',          'critical','pending',    DATE_ADD(CURDATE(), INTERVAL 1 DAY)),
  (3, 2, NULL,'Quarterly Compliance Run', 'Prepare Q3 compliance report for all facilities',             'high',   'pending',     DATE_ADD(CURDATE(), INTERVAL 14 DAY)),
  (3, 1, NULL,'Train New Staff Members',  'Conduct emission recording training for new field staff',     'low',    'completed',   DATE_SUB(CURDATE(), INTERVAL 5 DAY))
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- ============================================================
-- VIEWS - Useful Summary Views
-- ============================================================

CREATE OR REPLACE VIEW v_emission_summary AS
SELECT
  f.region,
  f.facility_name,
  COUNT(er.record_id)         AS total_records,
  SUM(er.co2_emissions)       AS total_co2,
  SUM(er.methane_emissions)   AS total_methane,
  SUM(er.total_co2e)          AS total_co2e,
  AVG(er.total_co2e)          AS avg_co2e,
  MAX(er.emission_date)       AS last_report,
  SUM(CASE WHEN er.status='approved' THEN 1 ELSE 0 END)  AS approved_count,
  SUM(CASE WHEN er.status='pending'  THEN 1 ELSE 0 END)  AS pending_count
FROM emission_records er
JOIN facilities f ON er.facility_id = f.facility_id
GROUP BY f.facility_id, f.region, f.facility_name
ORDER BY total_co2e DESC;

CREATE OR REPLACE VIEW v_compliance_status AS
SELECT
  COUNT(*)                                                             AS total_records,
  SUM(CASE WHEN status='approved'     THEN 1 ELSE 0 END)             AS approved,
  SUM(CASE WHEN status='pending'      THEN 1 ELSE 0 END)             AS pending,
  SUM(CASE WHEN status='under_review' THEN 1 ELSE 0 END)             AS under_review,
  SUM(CASE WHEN status='rejected'     THEN 1 ELSE 0 END)             AS rejected,
  ROUND(100.0 * SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) / COUNT(*), 2) AS compliance_pct
FROM emission_records;

-- ============================================================
-- STORED PROCEDURE - Monthly Compliance Report
-- ============================================================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_monthly_compliance(IN report_month DATE)
BEGIN
  SELECT
    f.facility_name, f.region,
    er.status,
    SUM(er.co2_emissions)     AS co2_total,
    SUM(er.methane_emissions) AS methane_total,
    SUM(er.total_co2e)        AS co2e_total,
    COUNT(*)                  AS record_count
  FROM emission_records er
  JOIN facilities f ON er.facility_id = f.facility_id
  WHERE YEAR(er.emission_date) = YEAR(report_month)
    AND MONTH(er.emission_date) = MONTH(report_month)
  GROUP BY f.facility_id, er.status
  ORDER BY f.facility_name;
END //
DELIMITER ;

-- ============================================================
-- End of Schema
-- ============================================================
