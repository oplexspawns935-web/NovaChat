FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

CMD python -c "import os; import subprocess; subprocess.run(['uvicorn', 'server:app', '--host', '0.0.0.0', '--port', os.environ.get('PORT', '8000')])"
