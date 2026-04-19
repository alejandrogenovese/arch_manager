"""
Health endpoints — listos para liveness/readiness probes de OCP.

- /healthz: liveness. Solo verifica que el proceso corre. Nunca toca DB.
- /readyz:  readiness. Verifica conectividad con DB. Si falla, OCP saca el pod
  del Service hasta que se recupere.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthOut)
def healthz() -> HealthOut:
    return HealthOut(status="ok")


@router.get("/readyz", response_model=HealthOut)
def readyz(db: Session = Depends(get_db)) -> HealthOut:
    try:
        db.execute(text("SELECT 1"))
        return HealthOut(status="ready", db="ok")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"db: {exc}") from exc
