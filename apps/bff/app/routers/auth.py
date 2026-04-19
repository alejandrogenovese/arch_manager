"""
Auth router — login / logout / me.

NOTA sobre Entra ID:
  Para el v1 (demo en Render), validamos username+password contra DB.
  Cuando se enchufe Entra ID en el banco, este router se reemplaza por:
    - /auth/login  → 302 al authorize endpoint de Entra (OIDC code+PKCE)
    - /auth/callback → intercambia el code por tokens, valida ID token,
                       crea sesión local con `issue_session(...)`.
  El resto del backend (routers, RBAC, dependencies) NO cambia: la sesión
  server-side es la misma abstracción.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.audit import log as audit_log
from app.auth import (
    client_ip,
    current_user,
    get_current_session,
    issue_session,
    revoke_session,
    to_user_out,
    verify_password,
)
from app.database import get_db
from app.models import SessionRow, User
from app.schemas import LoginIn, UserOut

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
        # mensaje genérico — no revelamos si el usuario existe
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")

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
def me(user: Annotated[User, Depends(current_user)]) -> UserOut:
    return to_user_out(user)
