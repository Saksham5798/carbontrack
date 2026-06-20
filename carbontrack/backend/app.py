from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from models import db

# Import Blueprints
from routes.auth import auth_bp
from routes.emissions import emissions_bp
from routes.facilities import facilities_bp
from routes.workflow import workflow_bp
from routes.reports import reports_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    CORS(app)
    db.init_app(app)
    jwt = JWTManager(app)
    
    # Register error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify(success=False, message="Endpoint not found"), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify(success=False, message="Internal server error"), 500
        
    @jwt.unauthorized_loader
    def unauthorized_response(callback):
        return jsonify(success=False, message="Missing Authorization Header"), 401
        
    @jwt.invalid_token_loader
    def invalid_token_response(callback):
        return jsonify(success=False, message="Invalid Token"), 401

    @jwt.expired_token_loader
    def expired_token_response(jwt_header, jwt_payload):
        return jsonify(success=False, message="Token has expired"), 401

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(emissions_bp, url_prefix='/api/emissions')
    app.register_blueprint(facilities_bp, url_prefix='/api/facilities')
    app.register_blueprint(workflow_bp, url_prefix='/api/workflow')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    
    @app.route('/api/health')
    def health_check():
        return jsonify(status='healthy', message='CarbonTrack API is running (Flask/Gunicorn)')

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
