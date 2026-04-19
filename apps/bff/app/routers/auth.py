"""
Auth router v2 — login / logout / me / change-password.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.audit import log as audit_log
from app.auth import (
    client_ip,
    current_user_allow_pw_change,
    get_current_session,
    hash_password,
    issue_session,
    revoke_all_user_sessions,
    revoke_session,
    to_user_out,
    verify_password,
)
from app.database import get_db
from app.models import SessionRow, User
from app.schemas import ChangePasswordIn, LoginIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    username = payload.user.strip().lower()
    user = db.query(User).filter(User.username == username, User.active == True).one_or_none()  # noqa: E712
    if not user or not verify_password(payload.pass_, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")

    # Password temporal expirada → el admin tiene que resetearla
    if user.must_change_password and user.temp_password_expires_at:
        exp = user.temp_password_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "La contraseña temporal expiró. Contactá al administrador para que la resetee.",
            )

    user.last_login_at = datetime.now(timezone.utc)
    issue_session(db, user, response)
    audit_log(db, actor=user, action="auth.login", detail=f"ip={client_ip(request)}")
    db.commit()
    return to_user_out(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session: Annotated[tuple[User, SessionRow], Depends(get_current_session)],
    db: Session = Depends(get_db),
) -> None:
    user, row = session
    revoke_session(db, row.id, response)
    audit_log(db, actor=user, action="auth.logout")
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(current_user_allow_pw_change)]) -> UserOut:
    """El frontend usa el flag must_change_password para saber si redirigir."""
    return to_user_out(user)


@router.post("/change-password", response_model=UserOut)
def change_password(
    payload: ChangePasswordIn,
    request: Request,
    session: Annotated[tuple[User, SessionRow], Depends(get_current_session)],
    db: Session = Depends(get_db),
) -> UserOut:
    user, current_session = session

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Contraseña actual incorrecta")

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "La nueva contraseña debe ser distinta a la actual",
        )

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    user.temp_password_expires_at = None

    # Seguridad: invalida todas las otras sesiones del usuario.
    revoked = revoke_all_user_sessions(db, user.id, except_sid=current_session.id)

    audit_log(db, actor=user, action="auth.change_password",
              detail=f"ip={client_ip(request)} revoked_sessions={revoked}")
    db.commit()
    db.refresh(user)
    return to_user_out(user)
