/**
 * UK National Wind Forecast Evaluation Portal — TypeScript Models
 * Reflects backend canonical schemas from app/models/schemas.py
 */

export interface DecisionGate {
  id: string;             // e.g. 'd1_1200'
  name: string;           // e.g. '12:00 D-1 Gate'
  cutoff_time: string;    // e.g. '12:00'
  day_offset: number;     // e.g. -1
  description: string;    // e.g. 'Operational day-ahead benchmark cutoff'
}

export type EvaluationStatus =
  | 'matched'
  | 'forecast_missing_at_cutoff'
  | 'actual_missing'
  | 'conflicting_source_rows';

export interface EvaluationRow {
  start_time_utc: string;
  start_time_local: string;
  settlement_date: string;
  settlement_period: number;      // 1 to 48 (or 50 in clock change)
  decision_cutoff_utc: string;
  selected_publish_time_utc: string | null;
  actual_generation_mw: number | null;
  forecast_generation_mw: number | null;
  signed_error_mw: number | null;       // forecast - actual (+ = over-forecast, - = under-forecast)
  absolute_error_mw: number | null;     // |forecast - actual|
  percentage_error: number | null;
  status: EvaluationStatus;
  provenance: string;
}

export interface SummaryResponse {
  month: string;                  // '2026-01'
  gate: string;                   // 'd1_1200'
  gate_name: string;
  timezone: string;
  total_expected_periods: number; // 1488 for Jan (31 * 48)
  paired_count: number;
  missing_forecast_count: number;
  missing_actual_count: number;
  coverage_percentage: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  mean_bias_mw: number | null;
  wape_percentage: number | null;
  total_actual_gwh: number | null;
  total_forecast_gwh: number | null;
  min_actual_mw: number | null;
  max_actual_mw: number | null;
  min_forecast_mw: number | null;
  max_forecast_mw: number | null;
  generated_at: string;
  freshness: string;
  warnings: string[];
}

export interface DailySummary {
  date: string;                   // '2026-01-01'
  expected_periods: number;       // 48
  paired_count: number;
  coverage_percentage: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  mean_bias_mw: number | null;
  wape_percentage: number | null;
  actual_energy_gwh: number | null;
  forecast_energy_gwh: number | null;
  min_actual_mw: number | null;
  max_actual_mw: number | null;
}

export interface PeriodsResponse {
  total_items: number;
  page: number;
  limit: number;
  total_pages: number;
  items: EvaluationRow[];
}

export interface RefreshStatus {
  state: 'idle' | 'running' | 'success' | 'failed';
  last_refreshed_at: string | null;
  actual_count: number;
  forecast_count: number;
  message: string;
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  timestamp: string;
  database_connected: boolean;
}
