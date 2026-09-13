FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/requirements-lock.txt server/requirements-lock.txt
RUN pip install --no-cache-dir -r server/requirements-lock.txt
COPY server server
COPY dist/classifications dist/classifications
RUN useradd --create-home --uid 10001 miyar && mkdir -p /app/.runtime /app/.model-cache && chown -R miyar:miyar /app
USER miyar
EXPOSE 8000
CMD ["python", "-m", "server.start"]
