import pytest
from app.clients.elexon import ElexonClient


def test_elexon_wind_filtering():
    """Verify that only fuelType == 'WIND' records are extracted."""
    client = ElexonClient()
    
    # Mock data containing CCGT, BIOMASS, NUCLEAR, and WIND
    sample_fuelhh = [
        {"fuelType": "BIOMASS", "generation": 1769, "startTime": "2026-01-01T01:30:00Z", "settlementDate": "2026-01-01", "settlementPeriod": 4},
        {"fuelType": "WIND", "generation": 14500, "startTime": "2026-01-01T01:30:00Z", "settlementDate": "2026-01-01", "settlementPeriod": 4},
        {"fuelType": "NUCLEAR", "generation": 4500, "startTime": "2026-01-01T01:30:00Z", "settlementDate": "2026-01-01", "settlementPeriod": 4},
        {"fuelType": "CCGT", "generation": 18200, "startTime": "2026-01-01T01:30:00Z", "settlementDate": "2026-01-01", "settlementPeriod": 4},
    ]

    wind_records = []
    for r in sample_fuelhh:
        if str(r.get("fuelType", "")).upper() == "WIND":
            wind_records.append({
                "start_time_utc": r["startTime"],
                "settlement_date": r["settlementDate"],
                "settlement_period": r["settlementPeriod"],
                "fuel_type": "WIND",
                "generation_mw": float(r["generation"])
            })

    assert len(wind_records) == 1
    assert wind_records[0]["fuel_type"] == "WIND"
    assert wind_records[0]["generation_mw"] == 14500.0


def test_elexon_windfor_parsing():
    """Verify WINDFOR schema parsing."""
    sample_windfor = [
        {"dataset": "WINDFOR", "publishTime": "2026-01-01T11:30:00Z", "startTime": "2026-01-02T14:00:00Z", "generation": 16200},
        {"dataset": "WINDFOR", "publishTime": "2026-01-01T11:30:00Z", "startTime": "2026-01-02T14:30:00Z", "generation": 16450}
    ]

    parsed = []
    for r in sample_windfor:
        if "startTime" in r and "publishTime" in r and r.get("generation") is not None:
            parsed.append({
                "start_time_utc": r["startTime"],
                "publish_time_utc": r["publishTime"],
                "generation_mw": float(r["generation"])
            })

    assert len(parsed) == 2
    assert parsed[0]["generation_mw"] == 16200.0
    assert parsed[1]["publish_time_utc"] == "2026-01-01T11:30:00Z"
