import React from 'react';
import { X, BookOpen, ShieldCheck, Database, GitBranch, Calculator, CheckCircle2 } from 'lucide-react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <BookOpen size={20} style={{ color: '#2563eb' }} />
            <h2 id="modal-title" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Evaluation Methodology & Audit Standard
            </h2>
          </div>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              padding: '0.25rem',
              borderRadius: '6px',
            }}
            onClick={onClose}
            aria-label="Close methodology modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Section 1: Overview */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#2563eb', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} /> 1. Operational Purpose & Backtest Design
            </h3>
            <p style={{ color: '#334155', fontSize: '0.85rem' }}>
              This portal provides <strong>decision-support evaluation</strong> for UK utility day-ahead power buyers. It benchmarks national wind generation forecasts against realized Elexon BMRS actual generation across all <strong>1,488 half-hourly settlement periods</strong> of January 2026 (31 days × 48 settlement periods/day).
            </p>
          </div>

          {/* Section 2: Cutoff Selection Logic */}
          <div style={{ backgroundColor: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#059669', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <GitBranch size={16} /> 2. Strict Cutoff & Vintage Selection Rule
            </h3>
            <p style={{ color: '#334155', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
              To replicate real-world trading without look-ahead bias, each target half-hour interval <code className="font-mono" style={{ color: '#2563eb' }}>t</code> is evaluated using only the latest forecast vintage available at the chosen decision gate:
            </p>
            <div className="formula-callout">
              arg max(publishTime) s.t. forecast.startTime == t AND publishTime &le; c(t)
            </div>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.75rem', fontSize: '0.82rem', color: '#475569' }}>
              <li style={{ marginBottom: '0.25rem' }}>
                <strong style={{ color: '#0f172a' }}>Default Gate (12:00 D-1):</strong> Cutoff occurs at 12:00 UK local time on the day prior to physical delivery (standard EPEX SPOT auction gate).
              </li>
              <li style={{ marginBottom: '0.25rem' }}>
                <strong style={{ color: '#0f172a' }}>Exclusion of Later Revisions:</strong> Any WINDFOR update published after the cutoff time is strictly disqualified from the evaluation of that gate.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>Missing Handling:</strong> If no forecast exists at or before cutoff, the status is flagged as <span className="badge badge-rose">forecast_missing_at_cutoff</span>. We never interpolate or substitute zeros.
              </li>
            </ul>
          </div>

          {/* Section 3: Data Lineage & Sources */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#7c3aed', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={16} /> 3. Canonical Elexon BMRS Data Sources
            </h3>
            <p style={{ color: '#334155', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
              Per regulatory standards, the system relies exclusively on official Balancing Mechanism Reporting Service (BMRS) streams:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#059669', display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                  Realized Actual: FUELHH
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                  Half-hourly outturn generation filtered to <code className="font-mono">fuelType=WIND</code>. Represents physical transmission-metered outturn across Great Britain.
                </span>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#2563eb', display: 'block', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                  Forecast Stream: WINDFOR
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                  National wind generation forecasts published by the National Energy System Operator (NESO). Includes historical publication timestamps (<code className="font-mono">publishTime</code>).
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Mathematical Metrics */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#d97706', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calculator size={16} /> 4. Evaluation Metrics & Mathematical Formulas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>Mean Absolute Error (MAE)</strong>
                  <span className="font-mono" style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 600 }}>MAE = (1 / N) * Σ |Forecast - Actual|</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#475569' }}>
                  Quantifies average forecast magnitude error in MW across all complete pairs. Robust against cancellation of over- and under-forecast errors.
                </p>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>Root Mean Square Error (RMSE)</strong>
                  <span className="font-mono" style={{ color: '#7c3aed', fontSize: '0.8rem', fontWeight: 600 }}>RMSE = √[ (1 / N) * Σ (Forecast - Actual)² ]</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#475569' }}>
                  Penalizes large extreme misses and steep ramp forecasting failures disproportionately, directly aligning with system imbalance risks.
                </p>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>Mean Signed Bias</strong>
                  <span className="font-mono" style={{ color: '#d97706', fontSize: '0.8rem', fontWeight: 600 }}>Bias = (1 / N) * Σ (Forecast - Actual)</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#475569' }}>
                  Positive (+): Over-forecast (System expected more wind than realized).<br />
                  Negative (−): Under-forecast (System generated more wind than predicted).
                </p>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>Weighted Absolute Percentage Error (WAPE)</strong>
                  <span className="font-mono" style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 600 }}>WAPE = ( Σ |Forecast - Actual| / Σ Actual ) * 100%</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#475569' }}>
                  Normalizes total absolute deviation by total actual realized wind energy, avoiding distortion from zero or near-zero calm periods.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Audit Guarantee Callout */}
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              color: '#065f46',
              fontSize: '0.8rem',
            }}
          >
            <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
            <div>
              <strong>Audit Guarantee:</strong> Calculations are strictly reproducible from canonical Elexon streams. Timestamps are normalized in aware UTC internally and presented in London local settlement time.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
