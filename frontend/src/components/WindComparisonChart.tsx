import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Calendar, RotateCcw, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { EvaluationRow } from '../types';

interface WindComparisonChartProps {
  data: EvaluationRow[];
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
  availableDates: string[];
  isLoading?: boolean;
}

export const WindComparisonChart: React.FC<WindComparisonChartProps> = ({
  data,
  selectedDate,
  onDateChange,
  availableDates,
  isLoading = false,
}) => {
  const [showActual, setShowActual] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showError, setShowError] = useState(true);

  // Filter data based on selected day if any
  const filteredData = useMemo(() => {
    if (!selectedDate) return data;
    return data.filter((r) => r.settlement_date === selectedDate);
  }, [data, selectedDate]);

  // Formatted chart points
  const chartPoints = useMemo(() => {
    return filteredData.map((row) => ({
      ...row,
      timeLabel: selectedDate
        ? `${row.start_time_local.substring(11, 16)} (SP${row.settlement_period})`
        : `${row.settlement_date.substring(5)} ${row.start_time_local.substring(11, 16)}`,
      actual: row.actual_generation_mw,
      forecast: row.forecast_generation_mw,
      signedError: row.signed_error_mw,
      isMissing: row.status !== 'matched',
    }));
  }, [filteredData, selectedDate]);

  // Statistics for the currently viewed range
  const rangeStats = useMemo(() => {
    const validPairs = filteredData.filter(
      (r) => r.actual_generation_mw !== null && r.forecast_generation_mw !== null
    );
    if (validPairs.length === 0) return null;

    let totalError = 0;
    let totalActual = 0;
    let maxGen = 0;

    validPairs.forEach((r) => {
      const err = Math.abs((r.forecast_generation_mw || 0) - (r.actual_generation_mw || 0));
      totalError += err;
      totalActual += r.actual_generation_mw || 0;
      if ((r.actual_generation_mw || 0) > maxGen) maxGen = r.actual_generation_mw || 0;
      if ((r.forecast_generation_mw || 0) > maxGen) maxGen = r.forecast_generation_mw || 0;
    });

    const mae = totalError / validPairs.length;
    const wape = totalActual > 0 ? (totalError / totalActual) * 100 : null;

    return {
      pointsCount: validPairs.length,
      mae,
      wape,
      maxGen,
      missingCount: filteredData.length - validPairs.length,
    };
  }, [filteredData]);

  // Custom rich clean tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload as (typeof chartPoints)[0];

    const actual = item.actual;
    const forecast = item.forecast;
    const signedErr = item.signedError;

    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-header">
          <span>{item.settlement_date} • SP {item.settlement_period}</span>
          <span className={`badge ${item.status === 'matched' ? 'badge-emerald' : 'badge-rose'}`}>
            {item.status}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div className="chart-tooltip-row">
            <span style={{ color: '#64748b' }}>Local UK Time:</span>
            <strong style={{ color: '#0f172a' }}>{item.start_time_local.substring(11, 16)} GMT</strong>
          </div>
          <div className="chart-tooltip-row">
            <span style={{ color: '#64748b' }}>UTC Interval:</span>
            <span className="font-mono" style={{ color: '#475569', fontSize: '0.78rem' }}>
              {item.start_time_utc}
            </span>
          </div>

          <div style={{ margin: '0.35rem 0', borderTop: '1px solid #f1f5f9' }} />

          <div className="chart-tooltip-row">
            <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#059669' }} />
              Realized Actual:
            </span>
            <strong style={{ color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
              {actual !== null ? `${actual.toLocaleString('en-GB', { maximumFractionDigits: 1 })} MW` : 'Missing'}
            </strong>
          </div>

          <div className="chart-tooltip-row">
            <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563eb' }} />
              D-1 Gate Forecast:
            </span>
            <strong style={{ color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
              {forecast !== null ? `${forecast.toLocaleString('en-GB', { maximumFractionDigits: 1 })} MW` : 'Missing'}
            </strong>
          </div>

          <div className="chart-tooltip-row">
            <span style={{ color: '#64748b', fontWeight: 500 }}>Signed Error (F − A):</span>
            <strong
              style={{
                fontFamily: 'var(--font-mono)',
                color:
                  signedErr === null
                    ? '#64748b'
                    : signedErr > 0
                    ? '#d97706'
                    : '#dc2626',
              }}
            >
              {signedErr !== null
                ? `${signedErr > 0 ? '+' : ''}${signedErr.toLocaleString('en-GB', { maximumFractionDigits: 1 })} MW`
                : 'N/A'}
            </strong>
          </div>

          <div style={{ margin: '0.35rem 0', borderTop: '1px solid #f1f5f9' }} />

          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            <div>
              Forecast Publish: <strong style={{ color: '#0f172a' }}>{item.selected_publish_time_utc || 'None'}</strong>
            </div>
            <div>Cutoff: {item.decision_cutoff_utc}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="wind-comparison-graph" className="chart-container" role="region" aria-label="Wind Generation Comparison Chart">

      <div className="chart-header">
        <div className="chart-title-block">
          <div className="chart-title">
            <span>National Actual Outturn vs. Day-Ahead Gate Forecast</span>
          </div>
          <div className="chart-subtitle">
            {selectedDate
              ? `Displaying 48 half-hour settlement periods for ${selectedDate}`
              : `Full January 2026 backtest series (1,488 half-hour periods)`}
          </div>
        </div>

        {/* Chart Controls & Day Filter */}
        <div className="chart-controls">
          {/* Day Selector */}
          <div className="gate-select-wrapper">
            <Calendar size={14} className="gate-select-icon" />
            <select
              className="gate-select font-mono"
              value={selectedDate || 'all'}
              onChange={(e) => onDateChange(e.target.value === 'all' ? null : e.target.value)}
              aria-label="Filter chart by specific date"
            >
              <option value="all">Full Month (Jan 1 – 31, 2026)</option>
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {date} (Day {parseInt(date.split('-')[2], 10)})
                </option>
              ))}
            </select>
          </div>

          {selectedDate && (
            <button
              className="btn-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => onDateChange(null)}
              title="Reset to full month"
            >
              <RotateCcw size={13} />
              <span>Full Month</span>
            </button>
          )}

          {isLoading && (
            <div className="filter-loading-pill animate-pulse">
              <RotateCcw size={12} className="animate-spin" />
              <span>Updating Chart...</span>
            </div>
          )}

          {/* Series Toggles */}
          <div className="filter-pills">
            <button
              className={`filter-pill ${showActual ? 'active' : ''}`}
              onClick={() => setShowActual(!showActual)}
              style={{ color: showActual ? '#059669' : undefined }}
            >
              ● Actual
            </button>
            <button
              className={`filter-pill ${showForecast ? 'active' : ''}`}
              onClick={() => setShowForecast(!showForecast)}
              style={{ color: showForecast ? '#2563eb' : undefined }}
            >
              ● Forecast
            </button>
            <button
              className={`filter-pill ${showError ? 'active' : ''}`}
              onClick={() => setShowError(!showError)}
              style={{ color: showError ? '#d97706' : undefined }}
            >
              ▮ Error Bars
            </button>
          </div>
        </div>
      </div>

      {/* Range Quick Stats Pill */}
      {rangeStats && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            padding: '0.65rem 1rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '0.82rem',
            color: '#475569',
            flexWrap: 'wrap',
          }}
        >
          <span>
            Evaluated Half-Hours: <strong style={{ color: '#0f172a' }}>{rangeStats.pointsCount}</strong>
          </span>
          <span>
            Window MAE:{' '}
            <strong style={{ color: '#2563eb' }}>
              {rangeStats.mae.toLocaleString('en-GB', { maximumFractionDigits: 1 })} MW
            </strong>
          </span>
          {rangeStats.wape !== null && (
            <span>
              Window WAPE:{' '}
              <strong style={{ color: '#059669' }}>{rangeStats.wape.toFixed(1)}%</strong>
            </span>
          )}
          <span>
            Window Peak:{' '}
            <strong style={{ color: '#0f172a' }}>
              {rangeStats.maxGen.toLocaleString('en-GB', { maximumFractionDigits: 0 })} MW
            </strong>
          </span>
          {rangeStats.missingCount > 0 && (
            <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <AlertTriangle size={13} />
              {rangeStats.missingCount} Missing Periods (Gaps Shown)
            </span>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div style={{ width: '100%', height: 380, minHeight: 380 }}>
        {chartPoints.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
            }}
          >
            No aligned periods available for the selected range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartPoints}
              margin={{ top: 10, right: 20, left: 10, bottom: 25 }}
            >
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

              <XAxis
                dataKey="timeLabel"
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 11 }}
                minTickGap={selectedDate ? 15 : 50}
                dy={8}
              />

              <YAxis
                yAxisId="genAxis"
                stroke="#94a3b8"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                domain={[0, 'auto']}
                label={{
                  value: 'Generation (MW)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#64748b',
                  fontSize: 11,
                  dy: 45,
                }}
              />

              {showError && (
                <YAxis
                  yAxisId="errAxis"
                  orientation="right"
                  stroke="#94a3b8"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}`}
                  domain={[-4000, 4000]}
                  hide={!showError}
                />
              )}

              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine yAxisId="genAxis" y={0} stroke="#e2e8f0" />
              {showError && <ReferenceLine yAxisId="errAxis" y={0} stroke="#cbd5e1" strokeDasharray="2 2" />}

              {/* Difference / Signed Error Bar */}
              {showError && (
                <Bar
                  yAxisId="errAxis"
                  dataKey="signedError"
                  name="Signed Error (MW)"
                  fill="#d97706"
                  opacity={0.3}
                  maxBarSize={6}
                />
              )}

              {/* Realized Actual Area */}
              {showActual && (
                <Area
                  yAxisId="genAxis"
                  type="monotone"
                  dataKey="actual"
                  name="Realized Actual (MW)"
                  stroke="#059669"
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill="url(#actualGradient)"
                  connectNulls={false} // Never impute zero; gaps remain visible
                />
              )}

              {/* Selected Day-Ahead Forecast Line */}
              {showForecast && (
                <Line
                  yAxisId="genAxis"
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast at Cutoff (MW)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                  connectNulls={false} // Missing forecast at cutoff remains visible gap
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Clean Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f1f5f9',
          fontSize: '0.78rem',
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#059669' }} />
            <span style={{ color: '#0f172a', fontWeight: 600 }}>Realized Actual Generation</span>
            <span>(FUELHH WIND)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2563eb' }} />
            <span style={{ color: '#0f172a', fontWeight: 600 }}>Cutoff Forecast</span>
            <span>(WINDFOR latest before gate)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: 10, height: 6, borderRadius: '2px', backgroundColor: '#d97706' }} />
            <span style={{ color: '#0f172a', fontWeight: 600 }}>Signed Deviation Bar</span>
            <span>(Forecast − Actual)</span>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Data Integrity: Missing half-hours are rendered as non-interpolated gaps.
        </div>
      </div>
    </div>
  );
};
