"""
Schemas Pydantic para los contratos del BFF.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DocType = Literal["hld", "adr", "rfc", "capability", "raci"]
DocStatus = Literal["Draft", "In Review", "Approved", "Deprecated"]
RoleName = Literal["arq_datos", "plataforma", "tech_lead", "admin"]


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    user: str
    pass_: str = Field(alias="pass")

    model_config = {"populate_by_name": True}


class UserOut(BaseModel):
    id: str
    user: str
    name: str
    role: RoleName
    permissions: list[str]


# ─── Documents ───────────────────────────────────────────────────────────────

class AttachmentOut(BaseModel):
    id: str
    name: str
    mime: str
    size: int
    url: str  # path BFF (no datos crudos en el JSON)


class DocOut(BaseModel):
    id: str
    type: DocType
    status: DocStatus
    title: str
    domain: str
    author: str
    sections: dict[str, str]
    createdAt: str  # ISO date
    updatedAt: str  # ISO date
    attachments: list[AttachmentOut] = []


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


# ─── Health ─────────────────────────────────────────────────────────────────

class HealthOut(BaseModel):
    status: str
    db: str | None = None
    version: str = "1.0.0"
