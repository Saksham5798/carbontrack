from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Task, EmissionRecord, User

workflow_bp = Blueprint('workflow', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)

def is_staff():
    user = get_current_user()
    return user and user.role == 'staff'

@workflow_bp.route('/tasks', methods=['GET'])
@jwt_required(optional=True)
def get_tasks():
    tasks = Task.query.order_by(Task.due_date.asc()).all()
    return jsonify(success=True, tasks=[t.to_dict() for t in tasks])

@workflow_bp.route('/tasks', methods=['POST'])
@jwt_required()
def create_task():
    if is_staff():
        return jsonify(success=False, message="You don't have permission to create tasks"), 403
        
    data = request.get_json()
    user_id = get_jwt_identity()
    new_task = Task(
        assigned_to=data.get('assigned_to'),
        title=data.get('title'),
        description=data.get('description'),
        priority=data.get('priority', 'medium'),
        due_date=data.get('due_date'),
        record_id=data.get('record_id'),
        created_by=user_id
    )
    db.session.add(new_task)
    db.session.commit()
    return jsonify(success=True, message="Task created", task=new_task.to_dict())

@workflow_bp.route('/tasks/<int:id>/status', methods=['PUT'])
@jwt_required()
def update_task_status(id):
    if is_staff():
        return jsonify(success=False, message="You don't have permission to update tasks"), 403
        
    task = Task.query.get_or_404(id)
    data = request.get_json()
    new_status = data.get('approval_status')
    
    if new_status:
        task.approval_status = new_status
        # If task is approved and linked to a record, approve the record as well
        if new_status == 'approved' and task.record_id:
            record = EmissionRecord.query.get(task.record_id)
            if record:
                record.status = 'approved'
                
    db.session.commit()
    return jsonify(success=True, message="Task updated")

@workflow_bp.route('/pending-approvals', methods=['GET'])
@jwt_required(optional=True)
def get_pending():
    count = Task.query.filter_by(approval_status='pending').count()
    return jsonify(success=True, pendingCount=count)
