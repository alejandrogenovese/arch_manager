"""
Sesiones server-side firmadas + helpers de auth.

Patrón BFF estándar:
- El navegador solo lleva una cookie HttpOnly + SameSite con el session id firmado.
- El payload de sesión vive en la tabla `sessions` (DB).
- Cuando se enchufe Entra ID, el flow OIDC code-with-PKCE termina creando esta
  misma sesión server-side; el resto del backend no cambia.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Cookie, Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import SessionRow, User
from app.rbac import perms_for
from app.schemas import UserOut

settings = get_settings()

# itsdangerous: firma el session id que viaja en la cookie.
_serializer = URLSafeTimedSerializer(settings.session_secret, salt="arch-mgr-session")

# bcrypt directo (sin passlib) — estándar bancario, costo 12 por defecto.
# bcrypt limita a 72 bytes; truncamos defensivamente para que passwords
# largos no exploten en lugar de fallar silenciosamente.
_BCRYPT_MAX = 72


def _to_bytes(pw: str) -> bytes:
    return pw.encode("utf-8")[:_BCRYPT_MAX]


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(_to_bytes(pw), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bytes(pw), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _new_sid() -> str:
    return secrets.token_urlsafe(32)


def issue_session(db: Session, user: User, response: Response) -> SessionRow:
    """Crea una sesión en DB y setea la cookie firmada en la response."""
    sid = _new_sid()
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.session_max_age_hours)
    row = SessionRow(id=sid, user_id=user.id, expires_at=expires)
    db.add(row)
    db.commit()

    signed = _serializer.dumps(sid)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=signed,
        max_age=settings.session_max_age_hours * 3600,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",   # Lax + same-origin (BFF + SPA juntos) = anti-CSRF razonable v1
        path="/",
    )
    return row


def revoke_session(db: Session, sid: str, response: Response) -> None:
    db.query(SessionRow).filter(SessionRow.id == sid).delete()
    db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")


def _decode_sid(signed_value: str) -> str | None:
    try:
        return _serializer.loads(
            signed_value,
            max_age=settings.session_max_age_hours * 3600,
        )
    except (BadSignature, SignatureExpired):
        return None


# ─── FastAPI dependencies ────────────────────────────────────────────────────

CookieDep = Annotated[str | None, Cookie(alias=settings.session_cookie_name)]


def get_current_session(
    raw_cookie: CookieDep = None,
    db: Session = Depends(get_db),
) -> tuple[User, SessionRow]:
    """Resuelve la sesión actual o lanza 401."""
    if not raw_cookie:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No session")

    sid = _decode_sid(raw_cookie)
    if not sid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")

    row = db.query(SessionRow).filter(SessionRow.id == sid).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session not found")

    # SQLite no preserva tzinfo en DateTime(timezone=True); normalizamos.
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        db.delete(row)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")

    user = db.query(User).filter(User.id == row.user_id, User.active == True).one_or_none()  # noqa: E712
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive")

    # touch
    row.last_seen_at = datetime.now(timezone.utc)
    db.commit()

    return user, row


def current_user(
    session: Annotated[tuple[User, SessionRow], Depends(get_current_session)],
) -> User:
    return session[0]


def to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        user=user.username,
        name=user.full_name,
        role=user.role,  # type: ignore[arg-type]
        permissions=sorted(perms_for(user.role)),  # type: ignore[arg-type]
    )


def require_perm(*needed: str):
    """Dependency factory: requiere alguno de los permisos."""
    def _dep(user: Annotated[User, Depends(current_user)]) -> User:
        granted = perms_for(user.role)  # type: ignore[arg-type]
        if not any(p in granted for p in needed):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
        return user
    return _dep


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "-"
