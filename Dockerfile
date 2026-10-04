# One image serves the whole site: FastAPI handles /api and /ws and serves the built frontend.

FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server/app server/app
COPY --from=web /app/web/dist web/dist
RUN useradd --create-home ruckus && mkdir -p /data && chown ruckus /data
USER ruckus
# SQLite fallback lives here when Supabase isn't configured (mount a volume to keep it)
ENV RUCKUS_DB=/data/ruckus.db
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=4s CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health')"
# Rooms live in memory, so run exactly one worker
CMD ["sh", "-c", "exec uvicorn app.main:app --app-dir server --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*' --ws-ping-interval 20 --ws-ping-timeout 20"]
