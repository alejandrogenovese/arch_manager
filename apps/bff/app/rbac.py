"""
RBAC — 5 roles.

Roles:
  - arq_datos   → autor de docs. Crea, edita y manda a revisión lo suyo.
  - arq_lead    → arquitecto líder. APRUEBA, deprecar, rechaza.
  - tech_lead   → visibilidad (futuro: comentarios). Hoy read-only.
  - dm          → delivery manager. Read-only (futuro: crear requisitos).
  - admin       → gestiona usuarios, hace soft delete/restore de docs.
                  NO edita contenido técnico ajeno.

Workflow de estados:
    Draft → In Review        (autor, o admin)
    In Review → Approved     (arq_lead, o admin)
    In Review → Draft        (arq_lead, admin — rechazo)
    Approved → Deprecated    (arq_lead, admin)

Soft delete (admin only):
    hide a docs/attachments con `deleted_at != NULL`.
"""
from typing import Iterable

from app.schemas import DocStatus, RoleName

ROLE_PERMS: dict[RoleName, set[str]] = {
    "arq_datos": {
        "doc.read",
        "doc.create",
        "doc.update_own",
        "attachment.write_own",
    },
    "arq_lead": {
        "doc.read",
        "doc.transition.approve",
        "doc.transition.deprecate",
        "doc.transition.review_to_draft",
    },
    "tech_lead": {
        "doc.read",
        "doc.transition.review_to_draft",   # puede rechazar docs en review
    },
    "dm": {
        "doc.read",
    },
    "admin": {
        "doc.read",
        "doc.delete_any",
        "doc.restore",
        "audit.read",
        "user.manage",
        "user.read",
    },
}

# Transiciones: (from, to) -> set de permisos que la habilitan.
TRANSITIONS: dict[tuple[DocStatus, DocStatus], set[str]] = {
    ("Draft", "In Review"):       {"doc.update_own"},
    ("In Review", "Approved"):    {"doc.transition.approve"},
    ("In Review", "Draft"):       {"doc.transition.review_to_draft"},
    ("Approved", "Deprecated"):   {"doc.transition.deprecate"},
}


def perms_for(role: RoleName) -> set[str]:
    return set(ROLE_PERMS.get(role, set()))


def can(role: RoleName, perm: str) -> bool:
    return perm in ROLE_PERMS.get(role, set())


def can_any(role: RoleName, perms: Iterable[str]) -> bool:
    rp = ROLE_PERMS.get(role, set())
    return any(p in rp for p in perms)


def can_edit_doc(role: RoleName, user_id: str, doc_author_id: str) -> bool:
    """Contenido técnico: solo el AUTOR. Admin NO edita contenido ajeno."""
    return role == "arq_datos" and user_id == doc_author_id


def can_delete_doc(role: RoleName) -> bool:
    return role == "admin"


def can_restore_doc(role: RoleName) -> bool:
    return role == "admin"


def can_transition(role: RoleName, user_id: str, doc_author_id: str,
                   from_status: DocStatus, to_status: DocStatus) -> bool:
    required = TRANSITIONS.get((from_status, to_status))
    if not required:
        return False

    if (from_status, to_status) == ("Draft", "In Review"):
        if role == "admin":
            return True
        return role == "arq_datos" and user_id == doc_author_id

    if role == "admin":
        return True

    return can_any(role, required)
