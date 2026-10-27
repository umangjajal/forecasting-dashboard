from datetime import datetime, timezone
from fastapi import APIRouter
from ...models.schemas import HealthResponse
from ...repositories.db import db
from ...config import settings

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health():
    db_connected = True
    try:
        counts = db.get_counts()
    except Exception:
        db_connected = False

    return HealthResponse(
        status="healthy" if db_connected else "degraded",
        app=settings.app_name,
        version=settings.app_version,
        timestamp=datetime.now(timezone.utc).isoformat(),
        database_connected=db_connected
    )
