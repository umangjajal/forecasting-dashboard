import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any
from ..clients.elexon import elexon_client
from ..repositories.db import db
from ..models.schemas import RefreshStatus

logger = logging.getLogger(__name__)


class IngestionService:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._state = "idle"
        self._last_refresh_at: str = None
        self._message = "System ready"

    def get_status(self) -> RefreshStatus:
        counts = db.get_counts()
        last_log = db.get_last_refresh()
        last_time = last_log["timestamp"] if last_log else self._last_refresh_at
        return RefreshStatus(
            state=self._state,
            last_refreshed_at=last_time,
            actual_count=counts["wind_actuals_count"],
            forecast_count=counts["forecasts_count"],
            message=self._message
        )

    async def run_refresh(self, force: bool = False) -> Dict[str, Any]:
        """
        Ingests January 2026 WIND actuals (FUELHH) and Day-Ahead forecasts (WINDFOR).
        Concurrency guarded by async lock.
        """
        if self._lock.locked():
            return {"status": "already_running", "message": "A refresh job is already in progress"}

        async with self._lock:
            self._state = "running"
            self._message = "Ingesting actuals and forecasts from Elexon BMRS stream..."
            logger.info("Starting January 2026 ingestion from Elexon BMRS...")

            try:
                # 1. Ingest Actuals for January 2026 (settlement dates 2026-01-01 to 2026-01-31)
                # To prevent oversized network loads, fetch in 7-day chunks
                total_actuals_saved = 0
                date_chunks = [
                    ("2026-01-01", "2026-01-08"),
                    ("2026-01-09", "2026-01-16"),
                    ("2026-01-17", "2026-01-24"),
                    ("2026-01-25", "2026-01-31"),
                ]

                for d_from, d_to in date_chunks:
                    try:
                        wind_rows = await elexon_client.fetch_wind_actuals(d_from, d_to)
                        if wind_rows:
                            saved = db.upsert_actuals(wind_rows)
                            total_actuals_saved += saved
                    except Exception as ex:
                        logger.warning(f"Error fetching FUELHH actuals chunk {d_from} - {d_to}: {ex}")

                # 2. Ingest WINDFOR forecasts published from 2025-12-30 to 2026-01-31
                # These forecasts cover delivery dates in January 2026
                total_forecasts_saved = 0
                fc_chunks = [
                    ("2025-12-30T00:00:00Z", "2026-01-08T00:00:00Z"),
                    ("2026-01-08T00:00:00Z", "2026-01-16T00:00:00Z"),
                    ("2026-01-16T00:00:00Z", "2026-01-24T00:00:00Z"),
                    ("2026-01-24T00:00:00Z", "2026-02-01T00:00:00Z"),
                ]

                for f_from, f_to in fc_chunks:
                    try:
                        fc_rows = await elexon_client.fetch_windfor_stream(f_from, f_to)
                        if fc_rows:
                            saved = db.upsert_forecasts(fc_rows)
                            total_forecasts_saved += saved
                    except Exception as ex:
                        logger.warning(f"Error fetching WINDFOR forecast chunk {f_from} - {f_to}: {ex}")

                counts = db.get_counts()
                self._state = "success"
                self._last_refresh_at = datetime.now(timezone.utc).isoformat()
                self._message = (
                    f"Successfully ingested {counts['wind_actuals_count']} wind actuals "
                    f"and {counts['forecasts_count']} forecasts."
                )

                db.log_ingestion("ALL", "SUCCESS", counts['wind_actuals_count'] + counts['forecasts_count'], self._message)

                return {
                    "status": "success",
                    "actuals_ingested": total_actuals_saved,
                    "forecasts_ingested": total_forecasts_saved,
                    "total_actuals": counts['wind_actuals_count'],
                    "total_forecasts": counts['forecasts_count']
                }

            except Exception as e:
                self._state = "failed"
                self._message = f"Refresh failed: {str(e)}"
                logger.error(f"Ingestion failed: {e}", exc_info=True)
                db.log_ingestion("ALL", "FAILED", 0, str(e))
                return {"status": "failed", "error": str(e)}


ingestion_service = IngestionService()
