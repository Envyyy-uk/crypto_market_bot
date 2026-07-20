# Backend для Hugging Face Spaces (Docker SDK).
# HF очікує, що застосунок слухає порт 7860 (app_port у README Space).
FROM python:3.12-slim

WORKDIR /app

# Спочатку залежності — цей шар кешується між білдами
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
