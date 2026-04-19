"""v2: admin panel + soft delete + roles refactor

Revision ID: 0001_v2_admin
Revises:
Create Date: 2026-04-19 20:00:00

Cambios:
  - users.must_change_password (bool, default false)
  - users.temp_password_expires_at (timestamptz nullable)
  - users.last_login_at (timestamptz nullable)
  - documents.deleted_at (timestamptz nullable, indexed)
  - attachments.deleted_at (timestamptz nullable)
  - Renombrar rol viejo 'plataforma' → mapearlo a 'tech_lead' (equivalente
    funcional en la nueva matriz RBAC). Si no existía (DB desde v2), no-op.

Cómo aplicar en Render (después del próximo deploy):
  1. Abrir Shell del web service en Render dashboard
  2. cd /app && alembic upgrade head
  3. Verificar con `alembic current`

En producción OCP:
  - Usar un initContainer que corra `alembic upgrade head`
    antes de que el container principal arranque.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_v2_admin"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── users: nuevos campos ────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(),
                  nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("temp_password_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ─── documents: soft delete ─────────────────────────────────────────
    op.add_column(
        "documents",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_documents_deleted_at", "documents", ["deleted_at"])

    # ─── attachments: soft delete ───────────────────────────────────────
    op.add_column(
        "attachments",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ─── Roles: migrar usuarios con rol 'plataforma' ────────────────────
    # El rol 'plataforma' en v1 podía rechazar docs en review. En v2 eso
    # lo hace tech_lead, así que migramos.
    op.execute("UPDATE users SET role = 'tech_lead' WHERE role = 'plataforma'")


def downgrade() -> None:
    # En un rollback, revertimos los ALTERs. No revertimos el UPDATE de
    # roles porque sería destructivo (no sabemos qué usuarios eran originalmente
    # plataforma vs tech_lead).
    op.drop_column("attachments", "deleted_at")
    op.drop_index("ix_documents_deleted_at", table_name="documents")
    op.drop_column("documents", "deleted_at")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "temp_password_expires_at")
    op.drop_column("users", "must_change_password")
