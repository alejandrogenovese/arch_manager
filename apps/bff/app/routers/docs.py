"""
Router de documentos: list / get / create / update / transition.
RBAC enforced en cada endpoint vía dependencies + checks por doc.
"""
from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.audit import log as audit_log
from app.auth import current_user, require_perm
from app.database import get_db
from app.models import Document, User
from app.rbac import can_edit_doc, can_transition
from app.schemas import (
    AttachmentOut,
    DocCreateIn,
    DocOut,
    DocUpdateIn,
    TransitionIn,
)

router = APIRouter(prefix="/docs", tags=["docs"])


def _doc_to_out(doc: Document) -> DocOut:
    return DocOut(
        id=doc.id,
        type=doc.type,  # type: ignore[arg-type]
        status=doc.status,  # type: ignore[arg-type]
        title=doc.title,
        domain=doc.domain or "",
        author=doc.author_name,
        sections=doc.sections or {},
        createdAt=doc.created_at.date().isoformat(),
        updatedAt=doc.updated_at.date().isoformat(),
        attachments=[
            AttachmentOut(
                id=a.id,
                name=a.filename,
                mime=a.mime,
                size=a.size_bytes,
                url=f"/api/attachments/{a.id}",
            )
            for a in doc.attachments
        ],
    )


@router.get("", response_model=list[DocOut])
def list_docs(
    _user: Annotated[User, Depends(current_user)],
    db: Session = Depends(get_db),
) -> list[DocOut]:
    rows = db.query(Document).order_by(desc(Document.updated_at)).all()
    return [_doc_to_out(d) for d in rows]


@router.get("/{doc_id}", response_model=DocOut)
def get_doc(
    doc_id: str,
    _user: Annotated[User, Depends(current_user)],
    db: Session = Depends(get_db),
) -> DocOut:
    doc = db.query(Document).filter(Document.id == doc_id).one_or_none()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")
    return _doc_to_out(doc)


@router.post("", response_model=DocOut, status_code=status.HTTP_201_CREATED)
def create_doc(
    payload: DocCreateIn,
    user: Annotated[User, Depends(require_perm("doc.create"))],
    db: Session = Depends(get_db),
) -> DocOut:
    now = datetime.now(timezone.utc)
    doc = Document(
        id=f"doc-{uuid4().hex[:10]}",
        type=payload.type,
        status="Draft",
        title=payload.title.strip(),
        domain=payload.domain.strip(),
        author_id=user.id,
        author_name=user.full_name,
        sections=payload.sections or {},
        created_at=now,
        updated_at=now,
    )
    db.add(doc)
    audit_log(db, actor=user, action="doc.create", doc_id=doc.id,
              detail=f"type={doc.type} title={doc.title!r}")
    db.commit()
    db.refresh(doc)
    return _doc_to_out(doc)


@router.put("/{doc_id}", response_model=DocOut)
def update_doc(
    doc_id: str,
    payload: DocUpdateIn,
    user: Annotated[User, Depends(current_user)],
    db: Session = Depends(get_db),
) -> DocOut:
    doc = db.query(Document).filter(Document.id == doc_id).one_or_none()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")

    if not can_edit_doc(user.role, user.id, doc.author_id):  # type: ignore[arg-type]
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No podés editar este documento")

    changed = []
    if payload.title is not None and payload.title != doc.title:
        doc.title = payload.title.strip()
        changed.append("title")
    if payload.domain is not None and payload.domain != doc.domain:
        doc.domain = payload.domain.strip()
        changed.append("domain")
    if payload.sections is not None:
        doc.sections = payload.sections
        changed.append("sections")

    if changed:
        doc.updated_at = datetime.now(timezone.utc)
        audit_log(db, actor=user, action="doc.update", doc_id=doc.id,
                  detail=f"fields={','.join(changed)}")
    db.commit()
    db.refresh(doc)
    return _doc_to_out(doc)


@router.post("/{doc_id}/transition", response_model=DocOut)
def transition_doc(
    doc_id: str,
    payload: TransitionIn,
    user: Annotated[User, Depends(current_user)],
    db: Session = Depends(get_db),
) -> DocOut:
    doc = db.query(Document).filter(Document.id == doc_id).one_or_none()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")

    from_status = doc.status  # type: ignore[assignment]
    to_status = payload.to

    if from_status == to_status:
        return _doc_to_out(doc)

    if not can_transition(user.role, user.id, doc.author_id, from_status, to_status):  # type: ignore[arg-type]
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"No podés transicionar de {from_status} a {to_status}",
        )

    doc.status = to_status
    doc.updated_at = datetime.now(timezone.utc)
    audit_log(db, actor=user, action="doc.transition", doc_id=doc.id,
              detail=f"{from_status} -> {to_status}")
    db.commit()
    db.refresh(doc)
    return _doc_to_out(doc)
