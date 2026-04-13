FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

ENV SMTP_SERVER=smtp.gmail.com
ENV SMTP_PORT=587
ENV SMTP_USERNAME=
ENV SMTP_PASSWORD=
ENV FROM_EMAIL=noreply@novachat.com
ENV APP_URL=https://novachat-production-8aef.up.railway.app

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
