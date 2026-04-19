"""
Sesiones server-side firmadas + helpers de auth — v2.

Novedades:
  - Helpers para generar password temporal (expira en 72h).
  - Dependency `current_user_allow_pw_change` para endpoints que deben
    funcionar aún con must_change_password=True (solo change-password).
  - current_user estándar bloquea (423) si must_change_password=True —
    fuerza al cliente a completar el cambio antes de navegar.
"""
import secrets
import string
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

_serializer = URLSafeTimedSerializer(settings.session_secret, salt="arch-mgr-session")

_BCRYPT_MAX = 72
TEMP_PW_TTL_HOURS = 72


def _to_bytes(pw: str) -> bytes:
    return pw.encode("utf-8")[:_BCRYPT_MAX]


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(_to_bytes(pw), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bytes(pw), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def generate_temp_password(length: int = 14) -> str:
    """Password temporal con minúsculas, mayúsculas y dígitos (sin símbolos raros)."""
    alphabet = string.ascii_letters + string.digits
    pw_chars = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
    ] + [secrets.choice(alphabet) for _ in range(length - 3)]
    secrets.SystemRandom().shuffle(pw_chars)
    return "".join(pw_chars)


def temp_pw_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=TEMP_PW_TTL_HOURS)


def _new_sid() -> str:
    return secrets.token_urlsafe(32)


def issue_session(db: Session, user: User, response: Response) -> SessionRow:
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
        samesite="lax",
        path="/",
    )
    return row


def revoke_session(db: Session, sid: str, response: Response) -> None:
    db.query(SessionRow).filter(SessionRow.id == sid).delete()
    db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")


def revoke_all_user_sessions(db: Session, user_id: str, except_sid: str | None = None) -> int:
    """Invalida todas las sesiones de un usuario. Se llama al cambiar password."""
    q = db.query(SessionRow).filter(SessionRow.user_id == user_id)
    if except_sid:
        q = q.filter(SessionRow.id != except_sid)
    count = q.delete()
    db.commit()
    return count


def _decode_sid(signed_value: str) -> str | None:
    try:
        return _serializer.loads(signed_value, max_age=settings.session_max_age_hours * 3600)
    except (BadSignature, SignatureExpired):
        return None


CookieDep = Annotated[str | None, Cookie(alias=settings.session_cookie_name)]


def _resolve_session(raw_cookie: str | None, db: Session) -> tuple[User, SessionRow]:
    if not raw_cookie:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No session")

    sid = _decode_sid(raw_cookie)
    if not sid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")

    row = db.query(SessionRow).filter(SessionRow.id == sid).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session not found")

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

    row.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return user, row


def get_current_session(
    raw_cookie: CookieDep = None,
    db: Session = Depends(get_db),
) -> tuple[User, SessionRow]:
    return _resolve_session(raw_cookie, db)


def current_user_allow_pw_change(
    session: Annotated[tuple[User, SessionRow], Depends(get_current_session)],
) -> User:
    """Permite operar aunque must_change_password=True. Solo para change-password."""
    return session[0]


def current_user(
    session: Annotated[tuple[User, SessionRow], Depends(get_current_session)],
) -> User:
    """Bloquea (423) si el usuario debe cambiar password."""
    user, _ = session
    if user.must_change_password:
        raise HTTPException(
            status.HTTP_423_LOCKED,
            "Debés cambiar tu contraseña antes de continuar.",
        )
    return user


def to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        user=user.username,
        name=user.full_name,
        role=user.role,  # type: ignore[arg-type]
        permissions=sorted(perms_for(user.role)),  # type: ignore[arg-type]
        must_change_password=user.must_change_password,
    )


def require_perm(*needed: str):
    def _dep(user: Annotated[User, Depends(current_user)]) -> User:
        granted = perms_for(user.role)  # type: ignore[arg-type]
        if not any(p in granted for p in needed):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
        return user
    return _dep


def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo administradores")
    return user


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "-"
