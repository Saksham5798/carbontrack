import os
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('JWT_SECRET', 'super_secret_production_key_123!')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET', 'super_secret_production_key_123!')
    
    DB_USER = os.getenv('DB_USER', 'carbontrack_user')
    DB_PASSWORD = urllib.parse.quote_plus(os.getenv('DB_PASSWORD', 'YourStrongPassword@123'))
    DB_HOST = os.getenv('DB_HOST', 'database')
    DB_PORT = os.getenv('DB_PORT', '3306')
    DB_NAME = os.getenv('DB_NAME', 'carbontrack_db')
    
    # SQLAlchemy Configuration
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
