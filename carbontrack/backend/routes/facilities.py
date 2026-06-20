from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Facility, EmissionRecord, User
from sqlalchemy import func

facilities_bp = Blueprint('facilities', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)

def is_staff():
    user = get_current_user()
    return user and user.role == 'staff'

@facilities_bp.route('', methods=['GET'])
@jwt_required(optional=True)
def get_facilities():
    # Fetch facilities with total emissions and record counts
    facilities = []
    facs = Facility.query.all()
    for f in facs:
        stats = db.session.query(
            func.sum(EmissionRecord.total_co2e).label('total_emissions'),
            func.count(EmissionRecord.record_id).label('total_records'),
            func.max(EmissionRecord.emission_date).label('last_report_date')
        ).filter_by(facility_id=f.facility_id).first()
        
        d = f.to_dict()
        d['total_emissions'] = float(stats.total_emissions) if stats and stats.total_emissions else 0
        d['total_records'] = stats.total_records if stats and stats.total_records else 0
        d['last_report_date'] = stats.last_report_date.isoformat() if stats and stats.last_report_date else None
        facilities.append(d)
        
    return jsonify(success=True, facilities=facilities)

@facilities_bp.route('', methods=['POST'])
@jwt_required()
def create_facility():
    if is_staff():
        return jsonify(success=False, message="You don't have permission to create facilities"), 403
        
    data = request.get_json()
    new_fac = Facility(
        facility_name=data.get('facility_name'),
        region=data.get('region'),
        facility_type=data.get('facility_type'),
        location=data.get('location'),
        capacity_mw=data.get('capacity_mw'),
        operational_since=data.get('operational_since')
    )
    db.session.add(new_fac)
    db.session.commit()
    return jsonify(success=True, message="Facility created", facility=new_fac.to_dict())

@facilities_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_facility(id):
    if is_staff():
        return jsonify(success=False, message="You don't have permission to delete facilities"), 403
        
    fac = Facility.query.get_or_404(id)
    db.session.delete(fac)
    db.session.commit()
    return jsonify(success=True, message="Facility deleted")
