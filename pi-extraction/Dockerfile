FROM python:3.12-slim

# Tesseract with Thai + English language data
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-tha tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY extraction_service.py ocr.py .

CMD ["python", "-u", "extraction_service.py"]
