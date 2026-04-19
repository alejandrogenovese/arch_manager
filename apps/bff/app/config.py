"""
Configuración de la app — leída 100% desde variables de entorno.
Mismo binario corre en Render y en OCP cambiando solo el entorno.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Entorno
    env: Literal["development", "production"] = "development"
    log_level: str = "INFO"

    # Base de datos
    database_url: str = "postgresql+psycopg://archmanager:archmanager@localhost:5432/archmanager"

    # Sesión
    session_secret: str = "dev-secret-change-me-please-32-chars-min"
    session_cookie_name: str = "arch_sid"
    session_max_age_hours: int = 8
    session_cookie_secure: bool = False  # True en prod (HTTPS)

    # Seed
    seed_on_startup: bool = True
    seed_default_password: str = "galicia123"

    # Migraciones automáticas al arrancar (True en Render, False en OCP)
    auto_migrate: bool = True

    # Password temporal (cuando admin crea usuario o resetea)
    temp_password_ttl_hours: int = 72

    # Static (SPA)
    serve_spa: bool = True
    spa_dist_dir: str = "/app/web_dist"

    # CORS (solo dev)
    cors_origins: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
