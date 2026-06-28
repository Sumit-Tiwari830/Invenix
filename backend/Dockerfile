FROM python:3.12-slim

WORKDIR /app

# Install system dependencies needed for sqlite and general builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Create data directory and ensure write permissions for Hugging Face non-root user
RUN mkdir -p data && chmod -R 777 data

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run FastAPI app on port 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
