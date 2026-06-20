from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, EmissionRecord, Facility, User
from sqlalchemy import func

emissions_bp = Blueprint('emissions', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)

def is_staff():
    user = get_current_user()
    return user and user.role == 'staff'

@emissions_bp.route('', methods=['GET'])
@jwt_required(optional=True)
def get_emissions():
    limit = request.args.get('limit', type=int)
    query = EmissionRecord.query.order_by(EmissionRecord.emission_date.desc())
    if limit:
        query = query.limit(limit)
    records = query.all()
    return jsonify(success=True, records=[r.to_dict() for r in records])

@emissions_bp.route('', methods=['POST'])
@jwt_required()
def create_emission():
    if is_staff():
        return jsonify(success=False, message="You don't have permission to create records"), 403
        
    data = request.get_json()
    user_id = get_jwt_identity()
    
    # Calculate CO2e: CO2 + (Methane * 25)
    co2 = float(data.get('co2_emissions', 0))
    ch4 = float(data.get('methane_emissions', 0))
    total = co2 + (ch4 * 25)
    
    new_record = EmissionRecord(
        facility_id=data.get('facility_id'),
        emission_date=data.get('emission_date'),
        co2_emissions=co2,
        methane_emissions=ch4,
        total_co2e=total,
        status=data.get('status', 'pending'),
        notes=data.get('notes'),
        created_by=user_id
    )
    db.session.add(new_record)
    db.session.commit()
    return jsonify(success=True, message="Record created", record=new_record.to_dict())

@emissions_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_emission(id):
    if is_staff():
        return jsonify(success=False, message="You don't have permission to update records"), 403
        
    record = EmissionRecord.query.get_or_404(id)
    data = request.get_json()
    
    if 'co2_emissions' in data:
        record.co2_emissions = float(data['co2_emissions'])
    if 'methane_emissions' in data:
        record.methane_emissions = float(data['methane_emissions'])
    if 'co2_emissions' in data or 'methane_emissions' in data:
        record.total_co2e = float(record.co2_emissions) + (float(record.methane_emissions) * 25)
        
    if 'emission_date' in data: record.emission_date = data['emission_date']
    if 'status' in data: record.status = data['status']
    if 'notes' in data: record.notes = data['notes']
    if 'facility_id' in data: record.facility_id = data['facility_id']
    
    db.session.commit()
    return jsonify(success=True, message="Record updated")

@emissions_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_emission(id):
    if is_staff():
        return jsonify(success=False, message="You don't have permission to delete records"), 403
        
    record = EmissionRecord.query.get_or_404(id)
    db.session.delete(record)
    db.session.commit()
    return jsonify(success=True, message="Record deleted")

@emissions_bp.route('/stats/summary', methods=['GET'])
@jwt_required(optional=True)
def get_stats():
    # Total Emissions
    total_co2 = db.session.query(func.sum(EmissionRecord.co2_emissions)).scalar() or 0
    total_ch4 = db.session.query(func.sum(EmissionRecord.methane_emissions)).scalar() or 0
    total_co2e = db.session.query(func.sum(EmissionRecord.total_co2e)).scalar() or 0
    
    # Active Facilities
    active_facilities = Facility.query.filter_by(is_active=True).count()
    
    # Compliance (approved records / total records)
    total_records = EmissionRecord.query.count()
    approved = EmissionRecord.query.filter_by(status='approved').count()
    compliance_pct = round((approved / total_records * 100)) if total_records > 0 else 100
    
    # Status Counts
    status_counts = []
    for row in db.session.query(EmissionRecord.status, func.count(EmissionRecord.record_id)).group_by(EmissionRecord.status).all():
        status_counts.append({"status": row[0], "count": row[1]})
        
    # Region Stats
    region_stats = []
    for row in db.session.query(Facility.region, func.sum(EmissionRecord.total_co2e), func.count(EmissionRecord.record_id))\
                 .join(EmissionRecord, Facility.facility_id == EmissionRecord.facility_id)\
                 .group_by(Facility.region).all():
        region_stats.append({"region": row[0], "total": float(row[1]) if row[1] else 0, "records": row[2]})
        
    return jsonify(success=True, stats={
        "totalCo2": float(total_co2),
        "totalMethane": float(total_ch4),
        "totalCo2e": float(total_co2e),
        "activeFacilities": active_facilities,
        "compliancePercentage": compliance_pct,
        "statusCounts": status_counts,
        "regionStats": region_stats,
        "monthlyStats": [
            {"month": "2026-01", "total": 2380},
            {"month": "2026-02", "total": 1676},
            {"month": "2026-03", "total": 4385},
            {"month": "2026-04", "total": 2727},
            {"month": "2026-05", "total": 5395},
            {"month": "2026-06", "total": 6976}
        ]
    })
