import sqlite3
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from ..config import settings


class Database:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.database_path
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Actual generation table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS actuals (
                    start_time_utc TEXT NOT NULL,
                    settlement_date TEXT NOT NULL,
                    settlement_period INTEGER NOT NULL,
                    fuel_type TEXT NOT NULL,
                    generation_mw REAL NOT NULL,
                    publish_time_utc TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (start_time_utc, fuel_type)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_actuals_start ON actuals(start_time_utc)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_actuals_fuel ON actuals(fuel_type)")

            # Forecast generation table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS forecasts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_time_utc TEXT NOT NULL,
                    publish_time_utc TEXT NOT NULL,
                    generation_mw REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE (start_time_utc, publish_time_utc)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecasts_start ON forecasts(start_time_utc)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecasts_publish ON forecasts(publish_time_utc)")

            # Ingestion audit log
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ingestion_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dataset TEXT NOT NULL,
                    status TEXT NOT NULL,
                    records_count INTEGER NOT NULL,
                    message TEXT,
                    timestamp TEXT NOT NULL
                )
            """)
            conn.commit()

    def upsert_actuals(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0
        now = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
                INSERT INTO actuals (
                    start_time_utc, settlement_date, settlement_period, fuel_type, generation_mw, publish_time_utc, created_at
                ) VALUES (
                    :start_time_utc, :settlement_date, :settlement_period, :fuel_type, :generation_mw, :publish_time_utc, :created_at
                )
                ON CONFLICT(start_time_utc, fuel_type) DO UPDATE SET
                    generation_mw = excluded.generation_mw,
                    publish_time_utc = excluded.publish_time_utc,
                    settlement_period = excluded.settlement_period,
                    settlement_date = excluded.settlement_date
            """, [
                {
                    "start_time_utc": r["start_time_utc"],
                    "settlement_date": r["settlement_date"],
                    "settlement_period": r["settlement_period"],
                    "fuel_type": r.get("fuel_type", "WIND"),
                    "generation_mw": float(r["generation_mw"]),
                    "publish_time_utc": r.get("publish_time_utc"),
                    "created_at": now
                }
                for r in records
            ])
            conn.commit()
            return cursor.rowcount

    def upsert_forecasts(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0
        now = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
                INSERT INTO forecasts (
                    start_time_utc, publish_time_utc, generation_mw, created_at
                ) VALUES (
                    :start_time_utc, :publish_time_utc, :generation_mw, :created_at
                )
                ON CONFLICT(start_time_utc, publish_time_utc) DO UPDATE SET
                    generation_mw = excluded.generation_mw
            """, [
                {
                    "start_time_utc": r["start_time_utc"],
                    "publish_time_utc": r["publish_time_utc"],
                    "generation_mw": float(r["generation_mw"]),
                    "created_at": now
                }
                for r in records
            ])
            conn.commit()
            return cursor.rowcount

    def get_actuals(self, start_utc: str, end_utc: str, fuel_type: str = "WIND") -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT start_time_utc, settlement_date, settlement_period, fuel_type, generation_mw, publish_time_utc
                FROM actuals
                WHERE fuel_type = ? AND start_time_utc >= ? AND start_time_utc <= ?
                ORDER BY start_time_utc ASC
            """, (fuel_type, start_utc, end_utc))
            return [dict(row) for row in cursor.fetchall()]

    def get_forecasts_for_target_periods(self, start_utc: str, end_utc: str) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT start_time_utc, publish_time_utc, generation_mw
                FROM forecasts
                WHERE start_time_utc >= ? AND start_time_utc <= ?
                ORDER BY start_time_utc ASC, publish_time_utc ASC
            """, (start_utc, end_utc))
            return [dict(row) for row in cursor.fetchall()]

    def log_ingestion(self, dataset: str, status: str, count: int, message: str = ""):
        now = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO ingestion_log (dataset, status, records_count, message, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (dataset, status, count, message, now))
            conn.commit()

    def get_last_refresh(self) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT dataset, status, records_count, message, timestamp
                FROM ingestion_log
                ORDER BY id DESC LIMIT 1
            """)
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_counts(self) -> Dict[str, int]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM actuals WHERE fuel_type = 'WIND'")
            actual_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM forecasts")
            forecast_count = cursor.fetchone()[0]
            return {
                "wind_actuals_count": actual_count,
                "forecasts_count": forecast_count
            }


db = Database()
