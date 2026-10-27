from typing import List, Optional
from pydantic import BaseModel, Field


class DecisionGate(BaseModel):
    id: str = Field(..., description="Unique gate identifier, e.g. 'd1_1200'")
    name: str = Field(..., description="Human readable label")
    cutoff_time: str = Field(..., description="Local cutoff time HH:MM")
    day_offset: int = Field(-1, description="Day offset relative to delivery date (-1 for D-1)")
    description: str = Field(..., description="Operational explanation of this cutoff")


class ActualRecord(BaseModel):
    start_time_utc: str
    settlement_date: str
    settlement_period: int
    fuel_type: str
    generation_mw: float
    publish_time_utc: Optional[str] = None


class ForecastRecord(BaseModel):
    start_time_utc: str
    publish_time_utc: str
    generation_mw: float


class EvaluationRow(BaseModel):
    start_time_utc: str
    start_time_local: str
    settlement_date: str
    settlement_period: int
    decision_cutoff_utc: str
    selected_publish_time_utc: Optional[str] = None
    actual_generation_mw: Optional[float] = None
    forecast_generation_mw: Optional[float] = None
    signed_error_mw: Optional[float] = None
    absolute_error_mw: Optional[float] = None
    percentage_error: Optional[float] = None
    status: str = Field(..., description="matched | forecast_missing_at_cutoff | actual_missing | conflicting_source_rows")
    provenance: str = Field("Elexon BMRS WINDFOR + FUELHH", description="Data source provenance")


class SummaryResponse(BaseModel):
    month: str
    gate: str
    gate_name: str
    timezone: str = "Europe/London"
    total_expected_periods: int
    paired_count: int
    missing_forecast_count: int
    missing_actual_count: int
    coverage_percentage: float
    mae_mw: Optional[float] = None
    rmse_mw: Optional[float] = None
    mean_bias_mw: Optional[float] = None
    wape_percentage: Optional[float] = None
    total_actual_gwh: Optional[float] = None
    total_forecast_gwh: Optional[float] = None
    min_actual_mw: Optional[float] = None
    max_actual_mw: Optional[float] = None
    min_forecast_mw: Optional[float] = None
    max_forecast_mw: Optional[float] = None
    generated_at: str
    freshness: str
    warnings: List[str] = Field(default_factory=list)


class DailySummary(BaseModel):
    date: str
    expected_periods: int
    paired_count: int
    coverage_percentage: float
    mae_mw: Optional[float] = None
    rmse_mw: Optional[float] = None
    mean_bias_mw: Optional[float] = None
    wape_percentage: Optional[float] = None
    actual_energy_gwh: Optional[float] = None
    forecast_energy_gwh: Optional[float] = None
    min_actual_mw: Optional[float] = None
    max_actual_mw: Optional[float] = None


class PeriodsResponse(BaseModel):
    total_items: int
    page: int
    limit: int
    total_pages: int
    items: List[EvaluationRow]


class RefreshStatus(BaseModel):
    state: str = Field(..., description="idle | running | success | failed")
    last_refreshed_at: Optional[str] = None
    actual_count: int = 0
    forecast_count: int = 0
    message: str = "Ready"


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    timestamp: str
    database_connected: bool
