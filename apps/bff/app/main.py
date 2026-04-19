"""
Entrypoint del BFF v2.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routers import attachments, audit, auth, docs, health, users
from app.seed import run_seed

settings = get_settings()
logging.basicConfig(level=settings.log_level)
log = logging.getLogger("arch-manager")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Migraciones: si AUTO_MIGRATE=true, corremos alembic upgrade head
    # antes que cualquier otra cosa. Es la forma más simple para Render
    # (no tenés shell confiable en el free tier). En OCP se usa un
    # initContainer dedicado y se pone AUTO_MIGRATE=false.
    if settings.auto_migrate:
        try:
            from alembic import command
            from alembic.config import Config
            alembic_cfg = Config("alembic.ini")
            alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
            command.upgrade(alembic_cfg, "head")
            log.info("Alembic: migraciones aplicadas")
        except Exception as exc:  # noqa: BLE001
            # No queremos tirar la app si alembic falla por un motivo tonto
            # (ej: primera vez que corre sobre tablas creadas con create_all).
            # La idempotencia de Alembic ya evita doble-aplicar.
            log.warning("Alembic falló, continúo con create_all: %s", exc)

    Base.metadata.create_all(bind=engine)
    log.info("Schema verificado/creado")

    if settings.seed_on_startup:
        with SessionLocal() as db:
            run_seed(db)
        log.info("Seed ejecutado (idempotente)")

    yield


app = FastAPI(title="Arch Manager BFF", version="1.1.0", lifespan=lifespan)

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
app.include_router(users.router, prefix="/api")
app.include_router(audit.router, prefix="/api")

# SPA
spa_dist = Path(settings.spa_dist_dir)

if settings.serve_spa and spa_dist.exists():
    assets_dir = spa_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa_fallback(path: str) -> FileResponse:
        candidate = spa_dist / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(spa_dist / "index.html")
else:
    log.warning(
        "SPA dist no encontrado en %s — el BFF corre solo. "
        "En dev, levantá el SPA con `npm run dev`.",
        settings.spa_dist_dir,
    )

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {"app": "Arch Manager BFF", "env": settings.env, "version": "1.1.0"}
