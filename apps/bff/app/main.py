"""
Entrypoint del BFF.

Estructura de URLs:
  /healthz, /readyz                  → liveness/readiness (probes)
  /api/auth/{login,logout,me}        → auth
  /api/docs/...                       → CRUD + transición de docs
  /api/docs/{id}/attachments          → upload
  /api/attachments/{id}               → download
  /                                    → SPA (en prod) o redirect a Vite (en dev)

Diseño BFF:
  - Cookie HttpOnly + SameSite=Lax con session id firmado.
  - SPA y BFF se sirven desde el MISMO origin → no hay CORS en prod.
  - En dev (SPA en :5173, BFF en :8000) se habilita CORS con credentials.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routers import attachments, auth, docs, health
from app.seed import run_seed

settings = get_settings()
logging.basicConfig(level=settings.log_level)
log = logging.getLogger("arch-manager")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # En v1 creamos schema con Base.metadata para arrancar rápido.
    # Para producción real: usar `alembic upgrade head` antes de arrancar el pod.
    Base.metadata.create_all(bind=engine)
    log.info("Schema verificado/creado")

    if settings.seed_on_startup:
        with SessionLocal() as db:
            run_seed(db)
        log.info("Seed ejecutado (idempotente)")

    yield


app = FastAPI(title="Arch Manager BFF", version="1.0.0", lifespan=lifespan)

# CORS solo cuando el SPA corre separado (dev local con Vite).
if settings.env == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Routers
app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(docs.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")


# ─── SPA ─────────────────────────────────────────────────────────────────────
# En producción servimos los estáticos del build de Vite desde el mismo proceso
# (1 contenedor, mismo origin, sin CORS, sesión cookie limpia).

spa_dist = Path(settings.spa_dist_dir)

if settings.serve_spa and spa_dist.exists():
    # Sirve assets de Vite (/assets/*) con caching agresivo.
    assets_dir = spa_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Sirve cualquier otro estático en raíz (favicon, logo, etc.)
    @app.get("/{path:path}", include_in_schema=False)
    async def spa_fallback(path: str) -> FileResponse:
        # Si el archivo existe físicamente en el dist, servirlo.
        candidate = spa_dist / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        # SPA fallback: devolvemos index.html para que React Router decida.
        index = spa_dist / "index.html"
        return FileResponse(index)
else:
    log.warning(
        "SPA dist no encontrado en %s — el BFF corre solo. "
        "En dev, levantá el SPA con `npm run dev` (Vite en :5173).",
        settings.spa_dist_dir,
    )

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {"app": "Arch Manager BFF", "env": settings.env, "spa": "no servido"}
