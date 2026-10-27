import math
from datetime import datetime, date, time, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple
try:
    from zoneinfo import ZoneInfo
    UK_TZ = ZoneInfo("Europe/London")
except Exception:
    UK_TZ = timezone(timedelta(hours=0), name="Europe/London")

from ..models.schemas import DecisionGate, EvaluationRow, SummaryResponse, DailySummary
from ..repositories.db import db


# Supported Decision Gates
CONFIGURED_GATES: Dict[str, DecisionGate] = {
    "d1_1200": DecisionGate(
        id="d1_1200",
        name="12:00 D-1 (EPEX SPOT UK Day-Ahead Auction)",
        cutoff_time="12:00",
        day_offset=-1,
        description="Standard EPEX SPOT UK Day-Ahead power auction bid submission cutoff at noon day-ahead"
    ),
    "d1_0900": DecisionGate(
        id="d1_0900",
        name="09:00 D-1 (Morning Day-Ahead Planning)",
        cutoff_time="09:00",
        day_offset=-1,
        description="Morning day-ahead portfolio balancing and position review"
    ),
    "d1_1700": DecisionGate(
        id="d1_1700",
        name="17:00 D-1 (Late Afternoon Gate)",
        cutoff_time="17:00",
        day_offset=-1,
        description="Late afternoon scheduling and intraday position true-up"
    ),
    "d1_2300": DecisionGate(
        id="d1_2300",
        name="23:00 D-1 (Pre-Delivery Midnight)",
        cutoff_time="23:00",
        day_offset=-1,
        description="End of day-ahead prior to physical target delivery day start"
    )
}


class WindEvaluator:
    @staticmethod
    def get_supported_gates() -> List[DecisionGate]:
        return list(CONFIGURED_GATES.values())

    @staticmethod
    def get_gate(gate_id: str) -> DecisionGate:
        if gate_id not in CONFIGURED_GATES:
            return CONFIGURED_GATES["d1_1200"]
        return CONFIGURED_GATES[gate_id]

    @staticmethod
    def generate_january_2026_intervals() -> List[Tuple[datetime, str, int]]:
        """
        Generates exactly 1,488 half-hour intervals for January 2026 in Europe/London.
        Returns: [(dt_utc, settlement_date_str, settlement_period)]
        """
        intervals = []
        # January has 31 days
        for day in range(1, 32):
            d = date(2026, 1, day)
            date_str = d.isoformat()
            for sp in range(1, 49):
                # Half-hour offset from midnight
                minutes_offset = (sp - 1) * 30
                dt_local = datetime.combine(d, time(0, 0), tzinfo=UK_TZ) + timedelta(minutes=minutes_offset)
                dt_utc = dt_local.astimezone(timezone.utc)
                intervals.append((dt_utc, date_str, sp))
        return intervals

    @staticmethod
    def calculate_cutoff_utc(target_dt_utc: datetime, gate: DecisionGate) -> datetime:
        """
        Derives the decision cutoff timestamp in UTC for a given target delivery interval.
        Uses Europe/London local calendar day-ahead rules.
        """
        # Convert target timestamp to UK local time
        target_local = target_dt_utc.astimezone(UK_TZ)
        delivery_date = target_local.date()
        
        # Apply day offset (e.g. -1 for D-1)
        decision_date = delivery_date + timedelta(days=gate.day_offset)
        
        # Parse cutoff time HH:MM
        cutoff_hour, cutoff_minute = map(int, gate.cutoff_time.split(":"))
        decision_dt_local = datetime.combine(
            decision_date,
            time(cutoff_hour, cutoff_minute),
            tzinfo=UK_TZ
        )
        return decision_dt_local.astimezone(timezone.utc)

    @staticmethod
    def evaluate_month(
        month: str = "2026-01",
        gate_id: str = "d1_1200"
    ) -> Tuple[List[EvaluationRow], SummaryResponse]:
        """
        Evaluates the full month (or specified range) by:
        1. Loading actuals and forecasts from SQLite repository
        2. Aligning half-hours to D-1 cutoff
        3. Selecting arg max(publishTime) <= cutoff
        4. Computing error metrics
        """
        gate = WindEvaluator.get_gate(gate_id)
        intervals = WindEvaluator.generate_january_2026_intervals()

        start_utc_str = intervals[0][0].strftime("%Y-%m-%dT%H:%M:%SZ")
        end_utc_str = (intervals[-1][0] + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Fetch actuals and forecasts
        raw_actuals = db.get_actuals(start_utc_str, end_utc_str, fuel_type="WIND")
        raw_forecasts = db.get_forecasts_for_target_periods(start_utc_str, end_utc_str)

        # Build actual lookup: start_time_utc -> actual dict
        actual_map: Dict[str, Dict[str, Any]] = {}
        for a in raw_actuals:
            # normalize ISO string without trailing seconds differences
            t_key = a["start_time_utc"]
            actual_map[t_key] = a

        # Build forecast lookup: start_time_utc -> list of (publish_dt, generation)
        forecast_map: Dict[str, List[Dict[str, Any]]] = {}
        for f in raw_forecasts:
            t_key = f["start_time_utc"]
            if t_key not in forecast_map:
                forecast_map[t_key] = []
            forecast_map[t_key].append(f)

        evaluation_rows: List[EvaluationRow] = []
        paired_errors: List[float] = []
        paired_actuals: List[float] = []
        paired_forecasts: List[float] = []

        missing_forecast_count = 0
        missing_actual_count = 0

        for dt_utc, settlement_date, settlement_period in intervals:
            utc_str = dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            local_dt = dt_utc.astimezone(UK_TZ)
            local_str = local_dt.isoformat()
            
            cutoff_dt_utc = WindEvaluator.calculate_cutoff_utc(dt_utc, gate)
            cutoff_utc_str = cutoff_dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

            # Actual lookup
            actual_rec = actual_map.get(utc_str)
            actual_gen = float(actual_rec["generation_mw"]) if actual_rec else None

            # Forecast selection: arg max(publish_time_utc <= cutoff_utc_str)
            eligible_forecasts = [
                f for f in forecast_map.get(utc_str, [])
                if f["publish_time_utc"] <= cutoff_utc_str
            ]

            selected_forecast_rec = None
            if eligible_forecasts:
                # Sort by publish_time_utc ascending, pick latest
                eligible_forecasts.sort(key=lambda x: x["publish_time_utc"])
                selected_forecast_rec = eligible_forecasts[-1]

            forecast_gen = float(selected_forecast_rec["generation_mw"]) if selected_forecast_rec else None
            selected_pub_time = selected_forecast_rec["publish_time_utc"] if selected_forecast_rec else None

            # Status determination
            if actual_gen is not None and forecast_gen is not None:
                status = "matched"
                signed_err = forecast_gen - actual_gen
                abs_err = abs(signed_err)
                pct_err = (signed_err / actual_gen * 100.0) if actual_gen > 0 else None
                
                paired_errors.append(signed_err)
                paired_actuals.append(actual_gen)
                paired_forecasts.append(forecast_gen)
            elif actual_gen is None and forecast_gen is not None:
                status = "actual_missing"
                signed_err = None
                abs_err = None
                pct_err = None
                missing_actual_count += 1
            elif actual_gen is not None and forecast_gen is None:
                status = "forecast_missing_at_cutoff"
                signed_err = None
                abs_err = None
                pct_err = None
                missing_forecast_count += 1
            else:
                status = "both_missing"
                signed_err = None
                abs_err = None
                pct_err = None
                missing_actual_count += 1
                missing_forecast_count += 1

            evaluation_rows.append(EvaluationRow(
                start_time_utc=utc_str,
                start_time_local=local_str,
                settlement_date=settlement_date,
                settlement_period=settlement_period,
                decision_cutoff_utc=cutoff_utc_str,
                selected_publish_time_utc=selected_pub_time,
                actual_generation_mw=round(actual_gen, 2) if actual_gen is not None else None,
                forecast_generation_mw=round(forecast_gen, 2) if forecast_gen is not None else None,
                signed_error_mw=round(signed_err, 2) if signed_err is not None else None,
                absolute_error_mw=round(abs_err, 2) if abs_err is not None else None,
                percentage_error=round(pct_err, 2) if pct_err is not None else None,
                status=status,
                provenance="Elexon BMRS WINDFOR + FUELHH"
            ))

        # Metrics aggregation
        total_expected = len(intervals)
        paired_count = len(paired_errors)
        coverage_pct = round((paired_count / total_expected * 100.0), 2) if total_expected > 0 else 0.0

        if paired_count > 0:
            mae = round(sum(abs(e) for e in paired_errors) / paired_count, 2)
            rmse = round(math.sqrt(sum(e ** 2 for e in paired_errors) / paired_count), 2)
            mean_bias = round(sum(paired_errors) / paired_count, 2)
            
            sum_actual = sum(paired_actuals)
            wape = round((sum(abs(e) for e in paired_errors) / sum_actual * 100.0), 2) if sum_actual > 0 else None
            
            # 30-minute power to energy: MW * 0.5 h = MWh; / 1000 = GWh
            total_act_gwh = round(sum_actual * 0.5 / 1000.0, 2)
            total_fc_gwh = round(sum(paired_forecasts) * 0.5 / 1000.0, 2)
            min_act = round(min(paired_actuals), 2)
            max_act = round(max(paired_actuals), 2)
            min_fc = round(min(paired_forecasts), 2)
            max_fc = round(max(paired_forecasts), 2)
        else:
            mae = None
            rmse = None
            mean_bias = None
            wape = None
            total_act_gwh = None
            total_fc_gwh = None
            min_act = None
            max_act = None
            min_fc = None
            max_fc = None

        warnings = []
        if paired_count < total_expected:
            warnings.append(
                f"Partial coverage: {paired_count} of {total_expected} periods paired. "
                f"{missing_forecast_count} missing forecasts at cutoff, {missing_actual_count} missing actuals."
            )

        summary = SummaryResponse(
            month=month,
            gate=gate.id,
            gate_name=gate.name,
            timezone="Europe/London",
            total_expected_periods=total_expected,
            paired_count=paired_count,
            missing_forecast_count=missing_forecast_count,
            missing_actual_count=missing_actual_count,
            coverage_percentage=coverage_pct,
            mae_mw=mae,
            rmse_mw=rmse,
            mean_bias_mw=mean_bias,
            wape_percentage=wape,
            total_actual_gwh=total_act_gwh,
            total_forecast_gwh=total_fc_gwh,
            min_actual_mw=min_act,
            max_actual_mw=max_act,
            min_forecast_mw=min_fc,
            max_forecast_mw=max_fc,
            generated_at=datetime.now(timezone.utc).isoformat(),
            freshness="synced" if paired_count > 0 else "empty",
            warnings=warnings
        )

        return evaluation_rows, summary

    @staticmethod
    def get_daily_summaries(
        month: str = "2026-01",
        gate_id: str = "d1_1200"
    ) -> List[DailySummary]:
        rows, _ = WindEvaluator.evaluate_month(month, gate_id)
        
        # Group by settlement_date
        by_date: Dict[str, List[EvaluationRow]] = {}
        for r in rows:
            d = r.settlement_date
            if d not in by_date:
                by_date[d] = []
            by_date[d].append(r)

        daily_list: List[DailySummary] = []
        for d in sorted(by_date.keys()):
            day_rows = by_date[d]
            matched_rows = [r for r in day_rows if r.status == "matched"]
            expected = len(day_rows)
            paired = len(matched_rows)
            coverage = round(paired / expected * 100.0, 2) if expected > 0 else 0.0

            if paired > 0:
                errors = [r.signed_error_mw for r in matched_rows]
                actuals = [r.actual_generation_mw for r in matched_rows]
                forecasts = [r.forecast_generation_mw for r in matched_rows]
                
                mae = round(sum(abs(e) for e in errors) / paired, 2)
                rmse = round(math.sqrt(sum(e ** 2 for e in errors) / paired), 2)
                mean_bias = round(sum(errors) / paired, 2)
                
                sum_act = sum(actuals)
                wape = round(sum(abs(e) for e in errors) / sum_act * 100.0, 2) if sum_act > 0 else None
                act_gwh = round(sum_act * 0.5 / 1000.0, 2)
                fc_gwh = round(sum(forecasts) * 0.5 / 1000.0, 2)
                min_act = round(min(actuals), 2)
                max_act = round(max(actuals), 2)
            else:
                mae = rmse = mean_bias = wape = act_gwh = fc_gwh = min_act = max_act = None

            daily_list.append(DailySummary(
                date=d,
                expected_periods=expected,
                paired_count=paired,
                coverage_percentage=coverage,
                mae_mw=mae,
                rmse_mw=rmse,
                mean_bias_mw=mean_bias,
                wape_percentage=wape,
                actual_energy_gwh=act_gwh,
                forecast_energy_gwh=fc_gwh,
                min_actual_mw=min_act,
                max_actual_mw=max_act
            ))
        return daily_list
