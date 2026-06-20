FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for cryptography/mysql client if needed
RUN apt-get update && apt-get install -y default-libmysqlclient-dev build-essential && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the Flask port
EXPOSE 5000

# Use Gunicorn as the production WSGI server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "app:app"]
