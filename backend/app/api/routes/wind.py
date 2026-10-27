import math
from typing import List, Optional
from fastapi import APIRouter, Query, BackgroundTasks, HTTPException
from ...models.schemas import (
    DecisionGate,
    SummaryResponse,
    DailySummary,
    PeriodsResponse,
    EvaluationRow,
    RefreshStatus
)
from ...services.evaluator import WindEvaluator
from ...services.ingestion import ingestion_service

router = APIRouter(prefix="/api/wind", tags=["Wind Forecast Evaluation"])


@router.get("/gates", response_model=List[DecisionGate])
def get_decision_gates():
    """
    Returns list of configured UK day-ahead decision gates.
    """
    return WindEvaluator.get_supported_gates()


@router.get("/summary", response_model=SummaryResponse)
def get_monthly_summary(
    month: str = Query("2026-01", description="Target month in YYYY-MM format"),
    gate: str = Query("d1_1200", description="Decision gate identifier")
):
    """
    Returns aggregate error metrics (MAE, RMSE, Bias, WAPE, Coverage) for the target month.
    """
    _, summary = WindEvaluator.evaluate_month(month=month, gate_id=gate)
    return summary


@router.get("/daily", response_model=List[DailySummary])
def get_daily_summaries(
    month: str = Query("2026-01", description="Target month in YYYY-MM format"),
    gate: str = Query("d1_1200", description="Decision gate identifier")
):
    """
    Returns day-by-day evaluation metrics for each day in January 2026.
    """
    return WindEvaluator.get_daily_summaries(month=month, gate_id=gate)


@router.get("/timeseries", response_model=List[EvaluationRow])
def get_timeseries(
    from_date: Optional[str] = Query(None, alias="from", description="ISO start timestamp filter"),
    to_date: Optional[str] = Query(None, alias="to", description="ISO end timestamp filter"),
    gate: str = Query("d1_1200", description="Decision gate identifier")
):
    """
    Returns aligned half-hourly evaluation series for charting.
    """
    rows, _ = WindEvaluator.evaluate_month(month="2026-01", gate_id=gate)
    
    if from_date:
        rows = [r for r in rows if r.start_time_utc >= from_date or r.settlement_date >= from_date]
    if to_date:
        rows = [r for r in rows if r.start_time_utc <= to_date or r.settlement_date <= to_date]
        
    return rows


def _filter_and_paginate_periods(
    gate: str = "d1_1200",
    q: Optional[str] = None,
    date: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    status: Optional[str] = "all",
    page: int = 1,
    limit: int = 50,
) -> PeriodsResponse:
    """
    Backend evaluation engine query & search processor.
    Performs server-side filtering across dates, status, settlement period, and full-text terms.
    """
    rows, _ = WindEvaluator.evaluate_month(month="2026-01", gate_id=gate)

    # Exact date filter
    if date and date.strip():
        target_date = date.strip()
        rows = [r for r in rows if r.settlement_date == target_date]

    # Date range filters
    if from_date:
        rows = [r for r in rows if r.start_time_utc >= from_date or r.settlement_date >= from_date]
    if to_date:
        rows = [r for r in rows if r.start_time_utc <= to_date or r.settlement_date <= to_date]

    # Status filter
    if status and status.lower() != "all":
        target_status = status.lower()
        if target_status == "missing":
            rows = [r for r in rows if r.status != "matched"]
        else:
            rows = [r for r in rows if r.status.lower() == target_status]

    # Server-side search filter (q)
    if q and q.strip():
        term = q.strip().lower()
        import re

        is_iso_date = bool(re.match(r"^\d{4}-\d{2}-\d{2}$", term))

        # Parse potential Settlement Period shorthand (e.g. "sp12", "sp 12", or numeric "12")
        sp_target = None
        if term.startswith("sp"):
            num_part = term[2:].strip()
            if num_part.isdigit():
                sp_target = int(num_part)
        elif term.isdigit() and 1 <= int(term) <= 50:
            sp_target = int(term)

        def matches(r: EvaluationRow) -> bool:
            if is_iso_date:
                return r.settlement_date == term
            if sp_target is not None and r.settlement_period == sp_target:
                return True
            if term in r.settlement_date.lower():
                return True
            if term in r.start_time_local.lower():
                return True
            if term in r.start_time_utc.lower():
                return True
            if term in r.status.lower():
                return True
            return False

        rows = [r for r in rows if matches(r)]

    total_items = len(rows)
    total_pages = math.ceil(total_items / limit) if total_items > 0 else 1
    
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    page_items = rows[start_idx:end_idx]

    return PeriodsResponse(
        total_items=total_items,
        page=page,
        limit=limit,
        total_pages=total_pages,
        items=page_items
    )


@router.get("/periods", response_model=PeriodsResponse)
def get_periods(
    q: Optional[str] = Query(None, description="Backend search term across date, SP, time, status"),
    date: Optional[str] = Query(None, description="Filter by exact settlement date YYYY-MM-DD"),
    from_date: Optional[str] = Query(None, alias="from", description="Start date/time filter"),
    to_date: Optional[str] = Query(None, alias="to", description="End date/time filter"),
    gate: str = Query("d1_1200", description="Decision gate identifier"),
    status: Optional[str] = Query("all", description="Filter by status: all, matched, missing, etc."),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(50, ge=1, le=500, description="Page size limit")
):
    """
    Returns server-paginated list of half-hour periods with search, date, and status filters applied on backend.
    """
    return _filter_and_paginate_periods(
        gate=gate,
        q=q,
        date=date,
        from_date=from_date,
        to_date=to_date,
        status=status,
        page=page,
        limit=limit
    )


@router.get("/search", response_model=PeriodsResponse)
def search_periods(
    q: Optional[str] = Query(None, description="Backend search query string"),
    date: Optional[str] = Query(None, description="Filter by exact settlement date YYYY-MM-DD"),
    from_date: Optional[str] = Query(None, alias="from", description="Start date/time filter"),
    to_date: Optional[str] = Query(None, alias="to", description="End date/time filter"),
    gate: str = Query("d1_1200", description="Decision gate identifier"),
    status: Optional[str] = Query("all", description="Filter by status: all, matched, missing, etc."),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(50, ge=1, le=500, description="Page size limit")
):
    """
    Dedicated Backend Search API for settlement periods and evaluation records.
    Filters by text, settlement period (e.g. SP24), date, and status on server side.
    """
    return _filter_and_paginate_periods(
        gate=gate,
        q=q,
        date=date,
        from_date=from_date,
        to_date=to_date,
        status=status,
        page=page,
        limit=limit
    )


@router.get("/refresh-status", response_model=RefreshStatus)
def get_refresh_status():
    """
    Returns the current data refresh state, counts, and last sync timestamp.
    """
    return ingestion_service.get_status()


@router.post("/refresh")
def trigger_refresh(background_tasks: BackgroundTasks):
    """
    Triggers an asynchronous refresh of January 2026 actuals and forecasts from Elexon BMRS.
    """
    background_tasks.add_task(ingestion_service.run_refresh)
    return {
        "status": "accepted",
        "message": "Data ingestion triggered in background"
    }
