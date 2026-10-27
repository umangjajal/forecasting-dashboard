import pytest
from fastapi.testclient import TestClient
from app.main import app
from seed_data import ensure_seeded

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_test_data():
    ensure_seeded()


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database_connected"] is True
    assert "version" in data


def test_decision_gates():
    response = client.get("/api/wind/gates")
    assert response.status_code == 200
    gates = response.json()
    assert len(gates) >= 4
    gate_ids = [g["id"] for g in gates]
    assert "d1_1200" in gate_ids
    assert "d1_0900" in gate_ids
    assert "d1_1700" in gate_ids
    assert "d1_2300" in gate_ids


def test_monthly_summary():
    response = client.get("/api/wind/summary?month=2026-01&gate=d1_1200")
    assert response.status_code == 200
    data = response.json()
    assert data["month"] == "2026-01"
    assert data["gate"] == "d1_1200"
    assert data["total_expected_periods"] == 1488
    assert data["paired_count"] == 1488
    assert data["coverage_percentage"] == 100.0
    assert data["mae_mw"] is not None and data["mae_mw"] > 0
    assert data["rmse_mw"] is not None and data["rmse_mw"] >= data["mae_mw"]
    assert data["mean_bias_mw"] is not None
    assert data["wape_percentage"] is not None
    assert data["total_actual_gwh"] is not None and data["total_actual_gwh"] > 0


def test_daily_summary():
    response = client.get("/api/wind/daily?month=2026-01&gate=d1_1200")
    assert response.status_code == 200
    daily_items = response.json()
    assert len(daily_items) == 31
    first_day = daily_items[0]
    assert first_day["date"] == "2026-01-01"
    assert first_day["expected_periods"] == 48
    assert first_day["paired_count"] == 48
    assert first_day["coverage_percentage"] == 100.0


def test_periods_pagination():
    response = client.get("/api/wind/periods?gate=d1_1200&page=1&limit=50")
    assert response.status_code == 200
    data = response.json()
    assert data["total_items"] == 1488
    assert data["page"] == 1
    assert data["limit"] == 50
    assert len(data["items"]) == 50
    
    first_item = data["items"][0]
    assert first_item["start_time_utc"] == "2026-01-01T00:00:00Z"
    assert first_item["actual_generation_mw"] is not None
    assert first_item["forecast_generation_mw"] is not None
    assert first_item["signed_error_mw"] is not None
    assert first_item["status"] == "matched"
    assert first_item["selected_publish_time_utc"] is not None


def test_backend_search_api():
    # Test dedicated search endpoint with settlement period shorthand "sp24"
    response = client.get("/api/wind/search?q=sp24&gate=d1_1200")
    assert response.status_code == 200
    data = response.json()
    assert data["total_items"] == 31  # 31 days in Jan 2026, each has SP24
    for item in data["items"]:
        assert item["settlement_period"] == 24

    # Test search with date query
    response_date = client.get("/api/wind/search?q=2026-01-15&gate=d1_1200")
    assert response_date.status_code == 200
    date_data = response_date.json()
    assert date_data["total_items"] == 48
    for item in date_data["items"]:
        assert item["settlement_date"] == "2026-01-15"

    # Test search with status
    response_status = client.get("/api/wind/search?q=matched&gate=d1_1200")
    assert response_status.status_code == 200
    status_data = response_status.json()
    assert status_data["total_items"] == 1488

    # Test periods endpoint with exact date parameter
    response_exact_date = client.get("/api/wind/periods?date=2026-01-20&gate=d1_1200&limit=100")
    assert response_exact_date.status_code == 200
    exact_data = response_exact_date.json()
    assert exact_data["total_items"] == 48
    assert len(exact_data["items"]) == 48


def test_timeseries():
    response = client.get("/api/wind/timeseries?gate=d1_1200")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1488


def test_refresh_status():
    response = client.get("/api/wind/refresh-status")
    assert response.status_code == 200
    data = response.json()
    assert data["state"] in ["idle", "running", "success"]
    assert data["actual_count"] >= 1488
    assert data["forecast_count"] >= 1488
