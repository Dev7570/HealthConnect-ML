FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY models/ models/
COPY app.py .

EXPOSE 5001

CMD ["gunicorn", "--workers", "2", "--threads", "2", "--timeout", "120", "-b", "0.0.0.0:5001", "app:app"]
