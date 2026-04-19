# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build del SPA (Vite)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS web-builder

WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY apps/web/ ./
RUN npm run build
# → /web/dist contiene index.html + assets/ con hashes

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Runtime del BFF (FastAPI + Uvicorn)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    SPA_DIST_DIR=/app/web_dist

# Solo las libs de runtime que necesita psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpq5 curl tini \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario non-root — requisito de seguridad de OCP (default SCC restricted)
RUN groupadd --system --gid 1001 app \
    && useradd  --system --uid 1001 --gid app --home /app --shell /sbin/nologin app

WORKDIR /app

# Instalar dependencias Python primero (mejor cache)
COPY apps/bff/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del BFF
COPY apps/bff/app           ./app
COPY apps/bff/alembic.ini   ./
COPY apps/bff/alembic       ./alembic

# Copiar el build del SPA al directorio que el BFF sirve estáticamente
COPY --from=web-builder /web/dist ./web_dist

# OCP requiere que el grupo root tenga permisos en los paths runtime
# (corre con UID arbitrario por SCC restricted)
RUN chgrp -R 0 /app && chmod -R g=u /app

USER 1001

EXPOSE 8000

# tini = init liviano (reaper de zombies, manejo correcto de SIGTERM)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
