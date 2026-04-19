"""
Engine y session factory de SQLAlchemy.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()


def _normalize_db_url(url: str) -> str:
    """
    Render (y otros PaaS) inyectan DATABASE_URL como `postgresql://...`
    o incluso el legacy `postgres://...`. SQLAlchemy interpreta ambos como
    el driver psycopg2 (v2), pero nosotros tenemos psycopg (v3) en
    requirements.txt. Reescribimos la URL al driver correcto.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


_db_url = _normalize_db_url(settings.database_url)

# Para SQLite (dev/tests) no tiene sentido pool_size/max_overflow.
_engine_kwargs: dict = {"pool_pre_ping": True, "echo": False}
if not _db_url.startswith("sqlite"):
    _engine_kwargs.update(pool_size=5, max_overflow=10)

engine = create_engine(_db_url, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
