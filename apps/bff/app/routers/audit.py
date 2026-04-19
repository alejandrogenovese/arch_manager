"""
Router de audit log — admin-only.

GET /api/audit
  ?actor_id=   → filtrar por actor
  ?doc_id=     → filtrar por doc
  ?action=     → filtrar por acción (prefijo match)
  ?limit=      → default 100, max 500
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import AuditLog, User
from app.schemas import AuditOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditOut])
def list_audit(
    _admin: Annotated[User, Depends(require_admin)],
    actor_id: str | None = Query(None),
    doc_id: str | None = Query(None),
    action: str | None = Query(None, description="Match por prefijo, ej: 'doc.' o 'auth.'"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[AuditOut]:
    q = db.query(AuditLog)
    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)
    if doc_id:
        q = q.filter(AuditLog.doc_id == doc_id)
    if action:
        q = q.filter(AuditLog.action.like(f"{action}%"))
    rows = q.order_by(AuditLog.at.desc()).limit(limit).all()
    return [
        AuditOut(
            id=r.id, actor_id=r.actor_id, actor_name=r.actor_name,
            doc_id=r.doc_id, action=r.action, detail=r.detail, at=r.at,
        )
        for r in rows
    ]
