from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum('admin', 'manager', 'staff'), default='staff')
    department = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
        
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'department': self.department,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }

class Facility(db.Model):
    __tablename__ = 'facilities'
    
    facility_id = db.Column(db.Integer, primary_key=True)
    facility_name = db.Column(db.String(150), nullable=False)
    region = db.Column(db.String(100), nullable=False)
    facility_type = db.Column(db.String(100))
    location = db.Column(db.String(255))
    capacity_mw = db.Column(db.Numeric(10, 2))
    operational_since = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'facility_id': self.facility_id,
            'facility_name': self.facility_name,
            'region': self.region,
            'facility_type': self.facility_type,
            'location': self.location,
            'capacity_mw': float(self.capacity_mw) if self.capacity_mw else None,
            'operational_since': self.operational_since.isoformat() if self.operational_since else None,
            'is_active': self.is_active
        }

class EmissionRecord(db.Model):
    __tablename__ = 'emission_records'
    
    record_id = db.Column(db.Integer, primary_key=True)
    facility_id = db.Column(db.Integer, db.ForeignKey('facilities.facility_id'))
    emission_date = db.Column(db.DateTime, nullable=False)
    co2_emissions = db.Column(db.Numeric(12, 4), nullable=False)
    methane_emissions = db.Column(db.Numeric(12, 4), default=0)
    total_co2e = db.Column(db.Numeric(12, 4))
    status = db.Column(db.Enum('pending', 'under_review', 'approved', 'rejected'), default='pending')
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    facility = db.relationship('Facility', backref=db.backref('emissions', lazy=True))

    def to_dict(self):
        return {
            'record_id': self.record_id,
            'facility_id': self.facility_id,
            'facility_name': self.facility.facility_name if self.facility else None,
            'region': self.facility.region if self.facility else None,
            'emission_date': self.emission_date.isoformat() if self.emission_date else None,
            'co2_emissions': float(self.co2_emissions) if self.co2_emissions else 0,
            'methane_emissions': float(self.methane_emissions) if self.methane_emissions else 0,
            'total_co2e': float(self.total_co2e) if self.total_co2e else 0,
            'status': self.status,
            'notes': self.notes,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Task(db.Model):
    __tablename__ = 'tasks'
    
    task_id = db.Column(db.Integer, primary_key=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'))
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    priority = db.Column(db.Enum('low', 'medium', 'high', 'critical'), default='medium')
    approval_status = db.Column(db.Enum('pending', 'in_progress', 'completed', 'rejected', 'approved'), default='pending')
    due_date = db.Column(db.DateTime)
    record_id = db.Column(db.Integer, db.ForeignKey('emission_records.record_id'))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    assignee = db.relationship('User', foreign_keys=[assigned_to])

    def to_dict(self):
        return {
            'task_id': self.task_id,
            'assigned_to': self.assigned_to,
            'assigned_to_name': self.assignee.name if self.assignee else None,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'approval_status': self.approval_status,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'record_id': self.record_id
        }

class Report(db.Model):
    __tablename__ = 'reports'
    
    report_id = db.Column(db.Integer, primary_key=True)
    report_type = db.Column(db.Enum('monthly', 'quarterly', 'annual', 'compliance'), nullable=False)
    from_date = db.Column(db.Date)
    to_date = db.Column(db.Date)
    region_filter = db.Column(db.String(100))
    total_records = db.Column(db.Integer)
    s3_url = db.Column(db.String(500))
    generated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    generated_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    generator = db.relationship('User', foreign_keys=[generated_by])

    def to_dict(self):
        return {
            'report_id': self.report_id,
            'report_type': self.report_type,
            'from_date': self.from_date.isoformat() if self.from_date else None,
            'to_date': self.to_date.isoformat() if self.to_date else None,
            'region_filter': self.region_filter,
            'total_records': self.total_records,
            's3_url': self.s3_url,
            'generated_by_name': self.generator.name if self.generator else None,
            'generated_date': self.generated_date.isoformat() if self.generated_date else None
        }
