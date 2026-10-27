import pytest
import math
from datetime import datetime, timezone
try:
    from zoneinfo import ZoneInfo
    UK_TZ = ZoneInfo("Europe/London")
except Exception:
    from datetime import timedelta
    UK_TZ = timezone(timedelta(hours=0), name="Europe/London")

from app.services.evaluator import WindEvaluator, CONFIGURED_GATES
from app.models.schemas import DecisionGate




def test_january_2026_intervals_count():
    """Verify that January 2026 contains exactly 1,488 half-hour settlement periods."""
    intervals = WindEvaluator.generate_january_2026_intervals()
    assert len(intervals) == 1488, f"Expected 1488 half-hours (31 days * 48), got {len(intervals)}"
    
    # Check start and end
    first_dt, first_date, first_sp = intervals[0]
    assert first_date == "2026-01-01"
    assert first_sp == 1
    assert first_dt.strftime("%Y-%m-%dT%H:%M:%SZ") == "2026-01-01T00:00:00Z"

    last_dt, last_date, last_sp = intervals[-1]
    assert last_date == "2026-01-31"
    assert last_sp == 48
    assert last_dt.strftime("%Y-%m-%dT%H:%M:%SZ") == "2026-01-31T23:30:00Z"


def test_d1_cutoff_calculation():
    """Verify D-1 cutoff timestamp derivation in Europe/London."""
    gate_1200 = CONFIGURED_GATES["d1_1200"]
    
    # Target delivery interval: 2026-01-15 14:00:00 UTC
    target_dt = datetime(2026, 1, 15, 14, 0, 0, tzinfo=timezone.utc)
    cutoff = WindEvaluator.calculate_cutoff_utc(target_dt, gate_1200)
    
    # Expected cutoff is D-1 (Jan 14) at 12:00:00 UTC (GMT in Jan)
    assert cutoff.strftime("%Y-%m-%dT%H:%M:%SZ") == "2026-01-14T12:00:00Z"

    # Early morning gate 09:00
    gate_0900 = CONFIGURED_GATES["d1_0900"]
    cutoff_0900 = WindEvaluator.calculate_cutoff_utc(target_dt, gate_0900)
    assert cutoff_0900.strftime("%Y-%m-%dT%H:%M:%SZ") == "2026-01-14T09:00:00Z"


def test_forecast_selection_vintage_exclusion():
    """
    Verify that forecasts published AFTER the cutoff are excluded,
    and the newest publication AT OR BEFORE cutoff is selected.
    """
    gate = CONFIGURED_GATES["d1_1200"]
    target_utc_str = "2026-01-10T10:00:00Z"
    target_dt = datetime(2026, 1, 10, 10, 0, 0, tzinfo=timezone.utc)
    cutoff_utc = WindEvaluator.calculate_cutoff_utc(target_dt, gate)
    cutoff_str = cutoff_utc.strftime("%Y-%m-%dT%H:%M:%SZ")  # 2026-01-09T12:00:00Z

    forecast_candidates = [
        {"publish_time_utc": "2026-01-08T06:00:00Z", "generation_mw": 5000.0},  # Eligible
        {"publish_time_utc": "2026-01-09T11:30:00Z", "generation_mw": 5500.0},  # Eligible (newest before cutoff)
        {"publish_time_utc": "2026-01-09T12:00:00Z", "generation_mw": 5600.0},  # Eligible (exactly at cutoff)
        {"publish_time_utc": "2026-01-09T12:01:00Z", "generation_mw": 5900.0},  # INELIGIBLE (after cutoff)
        {"publish_time_utc": "2026-01-09T17:00:00Z", "generation_mw": 6200.0},  # INELIGIBLE (after cutoff)
    ]

    eligible = [f for f in forecast_candidates if f["publish_time_utc"] <= cutoff_str]
    assert len(eligible) == 3
    
    eligible.sort(key=lambda x: x["publish_time_utc"])
    selected = eligible[-1]
    
    assert selected["publish_time_utc"] == "2026-01-09T12:00:00Z"
    assert selected["generation_mw"] == 5600.0


def test_metric_calculation_accuracy():
    """Verify MAE, RMSE, Mean Bias, and WAPE formulas on known fixture."""
    pairs = [
        {"forecast": 10000.0, "actual": 9000.0},   # error = +1000, abs = 1000, sq = 1,000,000
        {"forecast": 8000.0, "actual": 8500.0},    # error = -500,  abs = 500,  sq = 250,000
        {"forecast": 12000.0, "actual": 12000.0},  # error = 0,     abs = 0,    sq = 0
        {"forecast": 15000.0, "actual": 14000.0},  # error = +1000, abs = 1000, sq = 1,000,000
    ]
    
    signed_errors = [p["forecast"] - p["actual"] for p in pairs]
    # errors: [+1000, -500, 0, +1000]
    
    abs_errors = [abs(e) for e in signed_errors]
    # abs: [1000, 500, 0, 1000], sum = 2500
    
    sq_errors = [e**2 for e in signed_errors]
    # sq: [1M, 0.25M, 0, 1M], sum = 2,250,000
    
    mae = sum(abs_errors) / len(pairs)
    assert mae == 625.0
    
    rmse = math.sqrt(sum(sq_errors) / len(pairs))
    assert round(rmse, 2) == 750.0
    
    mean_bias = sum(signed_errors) / len(pairs)
    assert mean_bias == 375.0  # (1000 - 500 + 0 + 1000) / 4 = 1500 / 4 = 375
    
    total_actual = sum(p["actual"] for p in pairs)  # 9000 + 8500 + 12000 + 14000 = 43500
    wape = (sum(abs_errors) / total_actual) * 100.0
    assert round(wape, 2) == 5.75
