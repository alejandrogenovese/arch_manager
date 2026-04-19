"""
Alembic env.py — usa la metadata de SQLAlchemy de la app y el DATABASE_URL
de las env vars (no del alembic.ini).

Uso típico (en producción / OCP):
    1. Generar revisión:
        alembic revision --autogenerate -m "descripcion"
    2. Aplicar migraciones:
        alembic upgrade head

En v1 (Render demo) no se usa: el lifespan llama a Base.metadata.create_all()
para arrancar más rápido. Cuando se mueva a OCP productivo, cambiar a Alembic.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Importar la metadata + settings de la app
from app.config import get_settings
from app.database import Base
import app.models  # noqa: F401  (registra todos los modelos en Base.metadata)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Sobreescribir la URL del .ini con la env var (lo que corre en runtime)
config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
