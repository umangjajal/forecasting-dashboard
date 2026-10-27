import math
import random
from datetime import datetime, date, time, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
    UK_TZ = ZoneInfo("Europe/London")
except Exception:
    UK_TZ = timezone(timedelta(hours=0), name="Europe/London")

from app.repositories.db import db




def generate_january_2026_fixtures():
    """
    Generates realistic, physically plausible UK national wind actuals (FUELHH WIND)
    and day-ahead forecast publications (WINDFOR) for all 31 days (1,488 half-hours) of January 2026.
    Follows UK winter weather frontal patterns:
    - Base wind generation between 4,000 MW and 19,000 MW.
    - Weather fronts with 2-4 day periodicity.
    - Day-ahead forecasts issued at typical intervals (06:00, 11:30, 17:00, 22:30 on D-1).
    - Forecast error having standard realistic MAE (~1,100 MW) and small weather system timing shift.
    """
    actuals = []
    forecasts = []

    # Use fixed seed for deterministic reproducibility across tests and demos
    rng = random.Random(202601)

    # 31 days
    for day in range(1, 32):
        d = date(2026, 1, day)
        date_str = d.isoformat()
        
        # Weather synoptic wave (cyclonic low pressure systems)
        synoptic_wave = math.sin(day * 0.7) * 4500 + math.cos(day * 0.3) * 2500
        daily_mean = 11500 + synoptic_wave

        for sp in range(1, 49):
            min_offset = (sp - 1) * 30
            dt_local = datetime.combine(d, time(0, 0), tzinfo=UK_TZ) + timedelta(minutes=min_offset)
            dt_utc = dt_local.astimezone(timezone.utc)
            utc_str = dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

            # Diurnal atmospheric boundary layer effect
            hour = dt_local.hour + dt_local.minute / 60.0
            diurnal = math.sin((hour - 14) * math.pi / 12) * 1200
            
            # Short-term turbulence / gust component
            noise = rng.gauss(0, 350)
            
            actual_gen = max(1200.0, min(21000.0, daily_mean + diurnal + noise))
            
            # Actual outturn publish time (typically 15-30 min after interval end)
            pub_actual = (dt_utc + timedelta(minutes=45)).strftime("%Y-%m-%dT%H:%M:%SZ")

            actuals.append({
                "start_time_utc": utc_str,
                "settlement_date": date_str,
                "settlement_period": sp,
                "fuel_type": "WIND",
                "generation_mw": round(actual_gen, 1),
                "publish_time_utc": pub_actual
            })

            # Forecast revisions issued on D-1 and D-2
            # 1. Early morning D-1 forecast (06:00 UK local)
            d_minus_1 = d - timedelta(days=1)
            pub_d1_morning = datetime.combine(d_minus_1, time(6, 0), tzinfo=UK_TZ).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            fc_morning = max(800.0, actual_gen + rng.gauss(150, 1200))
            forecasts.append({
                "start_time_utc": utc_str,
                "publish_time_utc": pub_d1_morning,
                "generation_mw": round(fc_morning, 1)
            })

            # 2. Pre-auction noon D-1 forecast (11:30 UK local) - primary decision point for 12:00 gate!
            pub_d1_noon = datetime.combine(d_minus_1, time(11, 30), tzinfo=UK_TZ).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            fc_noon = max(1000.0, actual_gen + rng.gauss(80, 850))
            forecasts.append({
                "start_time_utc": utc_str,
                "publish_time_utc": pub_d1_noon,
                "generation_mw": round(fc_noon, 1)
            })

            # 3. Afternoon D-1 update (16:30 UK local) - eligible for 17:00 & 23:00 gates, but excluded from 12:00 gate!
            pub_d1_afternoon = datetime.combine(d_minus_1, time(16, 30), tzinfo=UK_TZ).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            fc_afternoon = max(1000.0, actual_gen + rng.gauss(40, 650))
            forecasts.append({
                "start_time_utc": utc_str,
                "publish_time_utc": pub_d1_afternoon,
                "generation_mw": round(fc_afternoon, 1)
            })

            # 4. Late night D-1 update (22:15 UK local) - eligible for 23:00 gate
            pub_d1_late = datetime.combine(d_minus_1, time(22, 15), tzinfo=UK_TZ).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            fc_late = max(1000.0, actual_gen + rng.gauss(20, 500))
            forecasts.append({
                "start_time_utc": utc_str,
                "publish_time_utc": pub_d1_late,
                "generation_mw": round(fc_late, 1)
            })

    return actuals, forecasts


def ensure_seeded(force: bool = False):
    """
    Ensures that January 2026 data is present in the database.
    """
    counts = db.get_counts()
    if counts["wind_actuals_count"] >= 1488 and counts["forecasts_count"] >= 1488 and not force:
        print(f"Database already populated: {counts['wind_actuals_count']} actuals, {counts['forecasts_count']} forecasts.")
        return

    print("Seeding database with January 2026 national wind actuals and multi-vintage forecasts...")
    actuals, forecasts = generate_january_2026_fixtures()
    db.upsert_actuals(actuals)
    db.upsert_forecasts(forecasts)
    db.log_ingestion("SEED", "SUCCESS", len(actuals) + len(forecasts), "Seeded complete January 2026 dataset")
    counts_after = db.get_counts()
    print(f"Seeding completed: {counts_after['wind_actuals_count']} wind actuals, {counts_after['forecasts_count']} forecasts.")


if __name__ == "__main__":
    ensure_seeded(force=True)
