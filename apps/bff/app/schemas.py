"""
Schemas Pydantic para los contratos del BFF — v2.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DocType = Literal["hld", "adr", "rfc", "capability", "raci"]
DocStatus = Literal["Draft", "In Review", "Approved", "Deprecated"]
RoleName = Literal["arq_datos", "arq_lead", "tech_lead", "admin", "dm"]

ALL_ROLES: tuple[str, ...] = ("arq_datos", "arq_lead", "tech_lead", "admin", "dm")


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    user: str
    pass_: str = Field(alias="pass")
    model_config = {"populate_by_name": True}


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=10, max_length=128)


class UserOut(BaseModel):
    id: str
    user: str
    name: str
    role: RoleName
    permissions: list[str]
    must_change_password: bool = False


# ─── User management (admin) ────────────────────────────────────────────────

class UserCreateIn(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._-]+$")
    full_name: str = Field(min_length=2, max_length=120)
    role: RoleName
    temporary_password: str | None = Field(default=None, min_length=10, max_length=128)


class UserUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    role: RoleName | None = None
    active: bool | None = None


class UserAdminOut(BaseModel):
    id: str
    username: str
    full_name: str
    role: RoleName
    active: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime


class UserCreatedOut(UserAdminOut):
    temporary_password: str


class PasswordResetOut(BaseModel):
    temporary_password: str


# ─── Documents ───────────────────────────────────────────────────────────────

class AttachmentOut(BaseModel):
    id: str
    name: str
    mime: str
    size: int
    url: str


class DocOut(BaseModel):
    id: str
    type: DocType
    status: DocStatus
    title: str
    domain: str
    author: str
    author_id: str
    sections: dict[str, str]
    createdAt: str
    updatedAt: str
    attachments: list[AttachmentOut] = []
    deleted_at: datetime | None = None


class DocCreateIn(BaseModel):
    type: DocType
    title: str = Field(min_length=1, max_length=240)
    domain: str = Field(default="", max_length=80)
    sections: dict[str, str] = Field(default_factory=dict)


class DocUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    domain: str | None = Field(default=None, max_length=80)
    sections: dict[str, str] | None = None


class TransitionIn(BaseModel):
    to: DocStatus


# ─── Audit ──────────────────────────────────────────────────────────────────

class AuditOut(BaseModel):
    id: str
    actor_id: str
    actor_name: str
    doc_id: str | None
    action: str
    detail: str
    at: datetime


# ─── Health ─────────────────────────────────────────────────────────────────

class HealthOut(BaseModel):
    status: str
    db: str | None = None
    version: str = "1.1.0"
