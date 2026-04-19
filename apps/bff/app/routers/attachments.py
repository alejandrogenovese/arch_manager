"""
Router de adjuntos v2 — ahora respeta soft delete.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.audit import log as audit_log
from app.auth import current_user
from app.database import get_db
from app.models import Attachment, Document, User
from app.rbac import can_edit_doc

router = APIRouter(tags=["attachments"])

MAX_BYTES = 8 * 1024 * 1024  # 8 MB

ALLOWED_MIME_PREFIXES = ("image/",)
ALLOWED_EXTENSIONS = (".drawio", ".xml", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")


def _is_allowed(filename: str, mime: str) -> bool:
    fn = filename.lower()
    if any(fn.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        return True
    if any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        return True
    return False


@router.post("/docs/{doc_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    doc_id: str,
    user: Annotated[User, Depends(current_user)],
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    doc = db.query(Document).filter(Document.id == doc_id).one_or_none()
    if not doc or doc.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")

    if not can_edit_doc(user.role, user.id, doc.author_id):  # type: ignore[arg-type]
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No podés modificar este documento")

    if not _is_allowed(file.filename or "", file.content_type or ""):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Tipo de archivo no permitido")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "El archivo supera 8 MB")

    att = Attachment(
        doc_id=doc.id,
        filename=file.filename or "archivo",
        mime=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        content=content,
        uploaded_by=user.id,
    )
    db.add(att)
    audit_log(db, actor=user, action="attachment.add", doc_id=doc.id,
              detail=f"name={att.filename!r} size={att.size_bytes}")
    db.commit()
    db.refresh(att)

    return {
        "id": att.id, "name": att.filename, "mime": att.mime,
        "size": att.size_bytes, "url": f"/api/attachments/{att.id}",
    }


@router.get("/attachments/{att_id}")
def get_attachment(
    att_id: str,
    user: Annotated[User, Depends(current_user)],
    db: Session = Depends(get_db),
) -> Response:
    att = db.query(Attachment).filter(Attachment.id == att_id).one_or_none()
    if not att or att.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adjunto no encontrado")

    # Si el doc padre está soft-deleted, solo admin puede bajarlo
    doc = db.query(Document).filter(Document.id == att.doc_id).one_or_none()
    if doc and doc.deleted_at is not None and user.role != "admin":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adjunto no encontrado")

    headers = {
        "Content-Disposition": f'inline; filename="{att.filename}"',
        "Cache-Control": "private, max-age=3600",
    }
    return Response(content=att.content, media_type=att.mime, headers=headers)


@router.delete("/attachments/{att_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    att_id: str,
    user: Annotated[User, Depends(current_user)],
    db: Session = Depends(get_db),
) -> None:
    att = db.query(Attachment).filter(Attachment.id == att_id).one_or_none()
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adjunto no encontrado")

    doc = db.query(Document).filter(Document.id == att.doc_id).one_or_none()
    if doc and not can_edit_doc(user.role, user.id, doc.author_id):  # type: ignore[arg-type]
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No podés modificar este documento")

    audit_log(db, actor=user, action="attachment.remove", doc_id=att.doc_id,
              detail=f"name={att.filename!r}")
    db.delete(att)
    db.commit()
