"""
Helper de audit log — append-only.
"""
from sqlalchemy.orm import Session

from app.models import AuditLog, User


def log(db: Session, *, actor: User, action: str, doc_id: str | None = None, detail: str = "") -> None:
    db.add(AuditLog(
        actor_id=actor.id,
        actor_name=actor.full_name,
        doc_id=doc_id,
        action=action,
        detail=detail,
    ))
    # Nota: el commit lo hace el caller para que entre en la misma transacción
    # que la operación auditada. Si el caller falla, el audit no queda huérfano.
