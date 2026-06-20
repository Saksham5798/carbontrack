from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Report, EmissionRecord, User
from sqlalchemy import func
import datetime

reports_bp = Blueprint('reports', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)

def is_staff():
    user = get_current_user()
    return user and user.role == 'staff'

@reports_bp.route('', methods=['GET'])
@jwt_required(optional=True)
def get_reports():
    reports = Report.query.order_by(Report.generated_date.desc()).all()
    return jsonify(success=True, reports=[r.to_dict() for r in reports])

@reports_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_report():
    if is_staff():
        return jsonify(success=False, message="You don't have permission to generate reports"), 403
        
    data = request.get_json()
    user_id = get_jwt_identity()
    
    report_type = data.get('report_type', 'monthly')
    
    # Calculate some summary stats for the report
    total_co2 = db.session.query(func.sum(EmissionRecord.co2_emissions)).scalar() or 0
    total_ch4 = db.session.query(func.sum(EmissionRecord.methane_emissions)).scalar() or 0
    total_co2e = db.session.query(func.sum(EmissionRecord.total_co2e)).scalar() or 0
    total_records = EmissionRecord.query.count()
    approved = EmissionRecord.query.filter_by(status='approved').count()
    
    new_report = Report(
        report_type=report_type,
        from_date=data.get('from_date'),
        to_date=data.get('to_date'),
        region_filter=data.get('region'),
        total_records=total_records,
        generated_by=user_id,
        s3_url=f"s3://carbontrack-reports/{report_type}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    )
    db.session.add(new_report)
    db.session.commit()
    
    summary = {
        "totalCo2": float(total_co2),
        "totalCh4": float(total_ch4),
        "totalCo2e": float(total_co2e),
        "totalRecords": total_records,
        "approved": approved
    }
    
    return jsonify(success=True, message="Report generated", report=new_report.to_dict(), summary=summary)
