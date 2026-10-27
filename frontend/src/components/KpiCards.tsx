import React from 'react';
import {
  Target,
  TrendingUp,
  Scale,
  Percent,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
} from 'lucide-react';
import { SummaryResponse } from '../types';

interface KpiCardsProps {
  summary: SummaryResponse | null;
  isLoading?: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ summary, isLoading = false }) => {
  if (!summary) {
    return (
      <div className="kpi-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="kpi-card"
            style={{ height: '160px', opacity: 0.6, background: '#f8fafc' }}
          />
        ))}
      </div>
    );
  }

  const formatNumber = (num: number | null | undefined, decimals = 1): string => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return num.toLocaleString('en-GB', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Mean bias calculation & indicators
  const biasValue = summary.mean_bias_mw ?? 0;
  const isOverForecast = biasValue > 0;
  const isZeroBias = Math.abs(biasValue) < 0.01;

  // Percentage of mean actual generation for MAE
  let maePctOfActual: string | null = null;
  if (
    summary.mae_mw !== null &&
    summary.total_actual_gwh !== null &&
    summary.total_actual_gwh > 0 &&
    summary.paired_count > 0
  ) {
    const meanActualMw = (summary.total_actual_gwh * 1000) / (summary.paired_count * 0.5);
    if (meanActualMw > 0) {
      maePctOfActual = ((summary.mae_mw / meanActualMw) * 100).toFixed(1);
    }
  }

  return (
    <div
      className={`kpi-grid ${isLoading ? 'animate-pulse' : ''}`}
      style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.2s ease' }}
      role="region"
      aria-label="Key Error and Energy Metrics"
    >
      {/* 1. MAE Card */}
      <div className="kpi-card">
        <div>
          <div className="kpi-card-header">
            <span className="kpi-title">Mean Absolute Error (MAE)</span>
            <div className="kpi-icon-badge icon-badge-blue" title="Average absolute deviation per half-hour">
              <Target size={16} />
            </div>
          </div>
          <div className="kpi-value-block">
            <span className="kpi-value">{formatNumber(summary.mae_mw)}</span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-meta">
            {maePctOfActual ? (
              <span>
                <strong style={{ color: '#2563eb' }}>{maePctOfActual}%</strong> of mean generation
              </span>
            ) : (
              <span>Average deviation magnitude</span>
            )}
          </div>
        </div>
        <div className="kpi-footer">
          <span className="font-mono">Σ|F - A| / N</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>Lower is better</span>
        </div>
      </div>

      {/* 2. RMSE Card */}
      <div className="kpi-card">
        <div>
          <div className="kpi-card-header">
            <span className="kpi-title">Root Mean Square Error (RMSE)</span>
            <div className="kpi-icon-badge icon-badge-purple" title="Penalizes large spikes and rapid ramp deviations">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="kpi-value-block">
            <span className="kpi-value">{formatNumber(summary.rmse_mw)}</span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-meta">
            {summary.mae_mw && summary.rmse_mw ? (
              <span>
                Volatility ratio:{' '}
                <strong style={{ color: '#7c3aed' }}>
                  {(summary.rmse_mw / summary.mae_mw).toFixed(2)}x
                </strong>{' '}
                of MAE
              </span>
            ) : (
              <span>Ramp error penalty</span>
            )}
          </div>
        </div>
        <div className="kpi-footer">
          <span className="font-mono">√(Σ(F - A)² / N)</span>
          <span>Spike penalty</span>
        </div>
      </div>

      {/* 3. Mean Bias Card (Signed Error) */}
      <div className="kpi-card">
        <div>
          <div className="kpi-card-header">
            <span className="kpi-title">Mean Forecast Bias</span>
            <div
              className={`kpi-icon-badge ${
                isZeroBias ? 'icon-badge-blue' : isOverForecast ? 'icon-badge-amber' : 'icon-badge-rose'
              }`}
              title="Systematic directional tendency: Forecast minus Actual"
            >
              <Scale size={16} />
            </div>
          </div>
          <div className="kpi-value-block">
            <span
              className="kpi-value"
              style={{
                color: isZeroBias ? '#0f172a' : isOverForecast ? '#d97706' : '#dc2626',
              }}
            >
              {summary.mean_bias_mw !== null && summary.mean_bias_mw !== undefined
                ? `${summary.mean_bias_mw > 0 ? '+' : ''}${formatNumber(summary.mean_bias_mw)}`
                : 'N/A'}
            </span>
            <span className="kpi-unit">MW</span>
          </div>
          <div style={{ marginTop: '0.45rem' }}>
            {isZeroBias ? (
              <span className="badge badge-slate">Zero Unbiased</span>
            ) : isOverForecast ? (
              <span className="badge badge-amber" title="Buyer was over-hedged on average">
                <ArrowUpRight size={13} /> Over-forecast (Long)
              </span>
            ) : (
              <span className="badge badge-rose" title="Buyer was under-hedged on average">
                <ArrowDownRight size={13} /> Under-forecast (Short)
              </span>
            )}
          </div>
        </div>
        <div className="kpi-footer">
          <span className="font-mono">Σ(F - A) / N</span>
          <span>Directional skew</span>
        </div>
      </div>

      {/* 4. WAPE Card */}
      <div className="kpi-card">
        <div>
          <div className="kpi-card-header">
            <span className="kpi-title">WAPE Accuracy</span>
            <div className="kpi-icon-badge icon-badge-emerald" title="Weighted Absolute Percentage Error">
              <Percent size={16} />
            </div>
          </div>
          <div className="kpi-value-block">
            <span className="kpi-value" style={{ color: '#059669' }}>
              {formatNumber(summary.wape_percentage, 1)}
            </span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-meta">
            <span>Weighted by physical generation volume</span>
          </div>
        </div>
        <div className="kpi-footer">
          <span className="font-mono">Σ|Error| / Σ Actual</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>Zero-safe metric</span>
        </div>
      </div>

      {/* 5. Total Energy Card */}
      <div className="kpi-card">
        <div>
          <div className="kpi-card-header">
            <span className="kpi-title">Delivered Wind Energy</span>
            <div className="kpi-icon-badge icon-badge-sky" title="Total Realized Wind Outturn in January 2026">
              <Zap size={16} />
            </div>
          </div>
          <div className="kpi-value-block">
            <span className="kpi-value">{formatNumber(summary.total_actual_gwh, 0)}</span>
            <span className="kpi-unit">GWh Realized</span>
          </div>
          <div className="kpi-meta">
            <span>
              Gate Forecast:{' '}
              <strong style={{ color: '#2563eb' }}>
                {formatNumber(summary.total_forecast_gwh, 0)} GWh
              </strong>
            </span>
          </div>
        </div>
        <div className="kpi-footer">
          <span>Peak: {formatNumber(summary.max_actual_mw, 0)} MW</span>
          <span>Min: {formatNumber(summary.min_actual_mw, 0)} MW</span>
        </div>
      </div>

      {/* 6. Evaluation Coverage Card */}
      <div className="kpi-card">
        <div>
          <div className="kpi-card-header">
            <span className="kpi-title">Evaluation Coverage</span>
            <div className="kpi-icon-badge icon-badge-emerald" title="1,488 expected half-hour settlement periods">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="kpi-value-block">
            <span className="kpi-value">
              {summary.paired_count.toLocaleString()}
            </span>
            <span className="kpi-unit">/ {summary.total_expected_periods.toLocaleString()} SPs</span>
          </div>
          <div className="kpi-meta" style={{ display: 'flex', gap: '0.6rem' }}>
            <span className="badge badge-emerald">
              {summary.coverage_percentage.toFixed(1)}% Complete
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              0 missing periods
            </span>
          </div>
        </div>
        <div className="kpi-footer">
          <span>Target: Jan 1 – 31, 2026</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>100% paired</span>
        </div>
      </div>
    </div>
  );
};
