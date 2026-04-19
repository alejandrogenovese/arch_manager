"""
Router bootstrap — para emergencias puntuales (reset del admin cuando
nadie sabe la password, migración de entornos sin credenciales, etc.).

DESHABILITADO POR DEFAULT. Solo responde si la env var BOOTSTRAP_TOKEN
está seteada y el cliente manda el mismo valor en el header X-Bootstrap-Token.

Patrón típico de banking/enterprise: el endpoint existe pero solo es
accesible con un secreto rotable que vive fuera del código. Una vez
usado, se borra la env var y el endpoint queda 404 hasta el próximo
deploy con token activo.

Uso:
    1. En Render dashboard, agregar env var BOOTSTRAP_TOKEN=<random-32-bytes-hex>
    2. Pushear código y rebuildear
    3. Correr:
         curl -X POST https://<app>.onrender.com/api/_bootstrap/reset-admin \
              -H "X-Bootstrap-Token: <token-que-pusiste>"
    4. Respuesta: { "username": "admin", "temporary_password": "..." }
    5. Loguear como admin con esa temp → sistema pide cambio de password
    6. Borrar BOOTSTRAP_TOKEN del dashboard y rebuildear.
       El endpoint queda inactivo (404) hasta que vuelvas a setearla.

Auditoría: cada invocación queda registrada en audit_log con
actor='system' action='bootstrap.reset_admin'.
"""
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import generate_temp_password, hash_password, temp_pw_expiry
from app.database import SessionLocal
from app.models import AuditLog, User

router = APIRouter(prefix="/_bootstrap", tags=["bootstrap"], include_in_schema=False)


def _get_token() -> str | None:
    """Leído fresco cada request para soportar rotación sin reiniciar."""
    token = os.environ.get("BOOTSTRAP_TOKEN", "").strip()
    return token or None


@router.post("/reset-admin")
def reset_admin(
    x_bootstrap_token: str = Header(default="", alias="X-Bootstrap-Token"),
) -> dict:
    expected = _get_token()

    # Sin token configurado → endpoint "no existe" (no revelamos si está
    # disponible o no).
    if not expected:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    # Constant-time compare para no exponer longitud del token via timing.
    import hmac
    if not hmac.compare_digest(x_bootstrap_token, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid bootstrap token")

    db: Session = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").one_or_none()
        temp_pw = generate_temp_password()

        if admin is None:
            # No existe → crearlo
            admin = User(
                username="admin",
                full_name="Admin",
                role="admin",
                password_hash=hash_password(temp_pw),
                active=True,
                must_change_password=True,
                temp_password_expires_at=temp_pw_expiry(),
            )
            db.add(admin)
            action_detail = "admin user created"
        else:
            # Existe → reset
            admin.password_hash = hash_password(temp_pw)
            admin.active = True
            admin.role = "admin"  # por las dudas (si alguien le cambió el rol)
            admin.must_change_password = True
            admin.temp_password_expires_at = temp_pw_expiry()
            action_detail = "admin password reset"

        db.flush()

        # Audit con actor=el propio admin (no tenemos otro actor confiable acá)
        db.add(AuditLog(
            actor_id=admin.id,
            actor_name=admin.full_name,
            doc_id=None,
            action="bootstrap.reset_admin",
            detail=action_detail,
            at=datetime.now(timezone.utc),
        ))
        db.commit()

        return {
            "username": "admin",
            "temporary_password": temp_pw,
            "expires_in_hours": 72,
            "next_steps": [
                "Loguear como admin con esta temp password",
                "Completar el cambio de contraseña obligatorio",
                "Borrar la env var BOOTSTRAP_TOKEN del dashboard y rebuildear",
            ],
        }
    finally:
        db.close()
