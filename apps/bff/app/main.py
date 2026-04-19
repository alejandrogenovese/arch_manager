"""
Entrypoint del BFF v2.
"""
import logging
import sys
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

# Logging EXPLÍCITO: handler de stdout con flush inmediato. Sin esto, en
# Render, si el proceso muere durante el lifespan startup, los logs se
# pierden y solo ves "Exited with status 3" sin traceback.
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
))
# Ojo: configurar el root logger, no crear uno nuevo.
root = logging.getLogger()
root.handlers[:] = [_handler]  # reemplazamos los handlers heredados
root.setLevel(settings.log_level)
log = logging.getLogger("arch-manager")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # 1. create_all() — crea tablas NUEVAS si no existen. Sobre tablas
        #    existentes no hace nada. Idempotente.
        log.info("Startup: creando/verificando schema base…")
        Base.metadata.create_all(bind=engine)
        log.info("Startup: schema base OK")

        # 2. Migración idempotente con SQL raw. No depende de Alembic
        #    (que queda como utilitario para OCP/dev local).
        #    Todos los ALTER usan IF NOT EXISTS — seguros incluso si corren
        #    muchas veces o sobre DB virgen.
        if settings.auto_migrate:
            from sqlalchemy import text
            log.info("Startup: aplicando migraciones v2…")
            with engine.begin() as conn:
                dialect = engine.dialect.name
                if dialect == "postgresql":
                    conn.execute(text(
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                        "must_change_password BOOLEAN NOT NULL DEFAULT FALSE"
                    ))
                    conn.execute(text(
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                        "temp_password_expires_at TIMESTAMPTZ"
                    ))
                    conn.execute(text(
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                        "last_login_at TIMESTAMPTZ"
                    ))
                    conn.execute(text(
                        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS "
                        "deleted_at TIMESTAMPTZ"
                    ))
                    conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_documents_deleted_at "
                        "ON documents(deleted_at)"
                    ))
                    conn.execute(text(
                        "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS "
                        "deleted_at TIMESTAMPTZ"
                    ))
                    # Migrar rol 'plataforma' → 'tech_lead' (sin efecto si no existe)
                    result = conn.execute(text(
                        "UPDATE users SET role = 'tech_lead' "
                        "WHERE role = 'plataforma'"
                    ))
                    if result.rowcount:
                        log.info("Migrados %d usuarios de plataforma → tech_lead",
                                 result.rowcount)
                else:
                    log.info("Dialecto %s: migraciones v2 sólo aplican en Postgres",
                             dialect)
            log.info("Startup: migraciones v2 OK")

        # 3. Seed (idempotente — no hace nada si ya hay usuarios)
        if settings.seed_on_startup:
            log.info("Startup: ejecutando seed…")
            with SessionLocal() as db:
                run_seed(db)
            log.info("Startup: seed OK")

        log.info("Startup completo — listo para recibir tráfico")

    except Exception:
        # Imprimimos el traceback a stdout DIRECTO para que Render lo vea
        # antes de que uvicorn mate el proceso. Sin esto, los logs del
        # lifespan fallido se pierden y solo ves "Exited with status 3".
        import traceback
        print("\n" + "=" * 70, flush=True)
        print("FATAL en lifespan startup:", flush=True)
        traceback.print_exc()
        print("=" * 70 + "\n", flush=True)
        sys.stdout.flush()
        sys.stderr.flush()
        raise

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
