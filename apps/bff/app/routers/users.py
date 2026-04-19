"""
Router de gestión de usuarios — admin only.

Endpoints:
  GET    /api/users                   → lista (active + inactive)
  POST   /api/users                   → crear (devuelve temp password UNA VEZ)
  GET    /api/users/{id}              → detalle
  PATCH  /api/users/{id}              → cambiar rol / activar / desactivar
  POST   /api/users/{id}/reset-password → genera nueva temp password
  DELETE /api/users/{id}              → soft delete (active=false)

Seguridad:
  - Admin NO puede leer passwords existentes (solo resetearlas).
  - Admin NO se puede auto-desactivar ni bajarse el rol.
  - Al resetear password se invalidan todas las sesiones del usuario.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import log as audit_log
from app.auth import (
    generate_temp_password,
    hash_password,
    require_admin,
    revoke_all_user_sessions,
    temp_pw_expiry,
)
from app.database import get_db
from app.models import User
from app.schemas import (
    PasswordResetOut,
    UserAdminOut,
    UserCreateIn,
    UserCreatedOut,
    UserUpdateIn,
)

router = APIRouter(prefix="/users", tags=["users"])


def _to_admin_out(user: User) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,  # type: ignore[arg-type]
        active=user.active,
        must_change_password=user.must_change_password,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


@router.get("", response_model=list[UserAdminOut])
def list_users(
    _admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> list[UserAdminOut]:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_to_admin_out(u) for u in users]


@router.get("/{user_id}", response_model=UserAdminOut)
def get_user(
    user_id: str,
    _admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> UserAdminOut:
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return _to_admin_out(user)


@router.post("", response_model=UserCreatedOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateIn,
    admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> UserCreatedOut:
    username = payload.username.strip().lower()

    # Unicidad
    existing = db.query(User).filter(User.username == username).one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese username")

    # Password temporal (o la que el admin haya pasado)
    temp_pw = payload.temporary_password or generate_temp_password()

    user = User(
        username=username,
        full_name=payload.full_name.strip(),
        role=payload.role,
        password_hash=hash_password(temp_pw),
        active=True,
        must_change_password=True,
        temp_password_expires_at=temp_pw_expiry(),
    )
    db.add(user)
    db.flush()

    audit_log(db, actor=admin, action="user.create",
              detail=f"username={user.username} role={user.role}")
    db.commit()
    db.refresh(user)

    return UserCreatedOut(
        **_to_admin_out(user).model_dump(),
        temporary_password=temp_pw,
    )


@router.patch("/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: str,
    payload: UserUpdateIn,
    admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> UserAdminOut:
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    # Protección: admin no puede auto-modificarse el rol ni desactivarse.
    if user.id == admin.id:
        if payload.role is not None and payload.role != admin.role:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No podés cambiar tu propio rol")
        if payload.active is False:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No podés desactivarte a vos mismo")

    changes: list[str] = []
    if payload.full_name is not None and payload.full_name != user.full_name:
        user.full_name = payload.full_name.strip()
        changes.append(f"full_name={user.full_name!r}")
    if payload.role is not None and payload.role != user.role:
        changes.append(f"role={user.role}→{payload.role}")
        user.role = payload.role
    if payload.active is not None and payload.active != user.active:
        changes.append(f"active={user.active}→{payload.active}")
        user.active = payload.active
        # Si se desactiva, invalidamos sus sesiones
        if not payload.active:
            revoke_all_user_sessions(db, user.id)

    if changes:
        audit_log(db, actor=admin, action="user.update",
                  detail=f"target={user.username} " + " ".join(changes))
    db.commit()
    db.refresh(user)
    return _to_admin_out(user)


@router.post("/{user_id}/reset-password", response_model=PasswordResetOut)
def reset_password(
    user_id: str,
    admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> PasswordResetOut:
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    temp_pw = generate_temp_password()
    user.password_hash = hash_password(temp_pw)
    user.must_change_password = True
    user.temp_password_expires_at = temp_pw_expiry()

    # Invalida todas las sesiones del usuario (si había alguna activa).
    revoke_all_user_sessions(db, user.id)

    audit_log(db, actor=admin, action="user.reset_password",
              detail=f"target={user.username}")
    db.commit()
    return PasswordResetOut(temporary_password=temp_pw)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: str,
    admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> None:
    """
    Soft delete: marca active=False. No borramos la row porque las FKs de
    documents.author_id y audit_log.actor_id deben seguir siendo válidas.
    """
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No podés desactivarte a vos mismo")

    user.active = False
    revoke_all_user_sessions(db, user.id)
    audit_log(db, actor=admin, action="user.deactivate", detail=f"target={user.username}")
    db.commit()
