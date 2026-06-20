import unittest
import json
import os
import sys

# Add the parent backend directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from models import db, User

class CarbonTrackTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        # Use an in-memory SQLite database for testing in CI
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app.config['JWT_SECRET_KEY'] = 'test_secret_key_123!'
        
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_health_check(self):
        """Test that the health check endpoint is live and returning correct status."""
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')
        self.assertIn('CarbonTrack API is running', data['message'])

    def test_unauthorized_users_endpoint(self):
        """Test that accessing the users route without a JWT returns unauthorized."""
        response = self.client.get('/api/auth/users')
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('Missing Authorization Header', data['message'])

    def test_invalid_jwt_token(self):
        """Test that accessing a route with an invalid JWT returns invalid token status."""
        response = self.client.get('/api/auth/users', headers={
            'Authorization': 'Bearer invalid_token_xyz_123'
        })
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('Invalid Token', data['message'])

if __name__ == '__main__':
    unittest.main()
