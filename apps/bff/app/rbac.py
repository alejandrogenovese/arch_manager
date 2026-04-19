"""
RBAC simple por rol — v1.

Roles (alineados con la app original):
  - arq_datos    → Arquitecto de Datos (Fernando, Lucía)
  - plataforma   → Equipo de Plataforma (Carlos)
  - tech_lead    → Tech Lead (aprueba)
  - admin        → todo

Decisiones:
  - "edit" sobre un doc requiere ser autor o admin (excepto plataforma que
    puede comentar/transicionar pero no editar contenido).
  - El workflow de estados es:
        Draft → In Review (Arq dueño o Admin)
        In Review → Approved (Tech Lead o Admin)
        In Review → Draft (Plataforma, Tech Lead, Admin) — rechazo
        Approved → Deprecated (Tech Lead o Admin)
"""
from typing import Iterable

from app.schemas import DocStatus, RoleName

# Permisos "globales" (no dependen del doc)
ROLE_PERMS: dict[RoleName, set[str]] = {
    "arq_datos":  {"doc.read", "doc.create", "doc.update_own", "attachment.write_own"},
    "plataforma": {"doc.read", "doc.transition.review_to_draft"},
    "tech_lead":  {"doc.read", "doc.transition.approve", "doc.transition.deprecate", "doc.transition.review_to_draft"},
    "admin":      {"doc.read", "doc.create", "doc.update_any", "doc.transition.any",
                   "attachment.write_any", "user.manage"},
}

# Transiciones permitidas: (from_status, to_status) -> set de permisos requeridos
# (cualquier permiso de la lista habilita la transición)
TRANSITIONS: dict[tuple[DocStatus, DocStatus], set[str]] = {
    ("Draft", "In Review"):       {"doc.update_own", "doc.update_any", "doc.transition.any"},
    ("In Review", "Approved"):    {"doc.transition.approve", "doc.transition.any"},
    ("In Review", "Draft"):       {"doc.transition.review_to_draft", "doc.transition.any"},
    ("Approved", "Deprecated"):   {"doc.transition.deprecate", "doc.transition.any"},
}


def perms_for(role: RoleName) -> set[str]:
    return set(ROLE_PERMS.get(role, set()))


def can(role: RoleName, perm: str) -> bool:
    return perm in ROLE_PERMS.get(role, set())


def can_any(role: RoleName, perms: Iterable[str]) -> bool:
    role_perms = ROLE_PERMS.get(role, set())
    return any(p in role_perms for p in perms)


def can_edit_doc(role: RoleName, user_id: str, doc_author_id: str) -> bool:
    if role == "admin":
        return True
    if role == "arq_datos" and user_id == doc_author_id:
        return True
    return False


def can_transition(role: RoleName, user_id: str, doc_author_id: str,
                   from_status: DocStatus, to_status: DocStatus) -> bool:
    required = TRANSITIONS.get((from_status, to_status))
    if not required:
        return False
    if "doc.transition.any" in required and role == "admin":
        return True
    # Ojo: Draft → In Review requiere que sea el autor (o admin)
    if (from_status, to_status) == ("Draft", "In Review"):
        if role == "admin":
            return True
        if role == "arq_datos" and user_id == doc_author_id:
            return True
        return False
    # El resto: chequeo por permisos del rol
    return can_any(role, required)
