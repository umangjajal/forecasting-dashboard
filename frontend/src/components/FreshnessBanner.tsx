import React from 'react';
import { ShieldCheck, Database, Calendar, AlertCircle, Info, Zap } from 'lucide-react';
import { SummaryResponse } from '../types';

interface FreshnessBannerProps {
  summary: SummaryResponse | null;
}

export const FreshnessBanner: React.FC<FreshnessBannerProps> = ({ summary }) => {
  if (!summary) return null;

  const isFullCoverage = summary.coverage_percentage >= 99.9;
  const hasWarnings = summary.warnings && summary.warnings.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="freshness-banner" role="region" aria-label="Dataset Freshness & Provenance">
        <div className="freshness-metrics">
          {/* Coverage Status */}
          <div className="freshness-item">
            <ShieldCheck
              size={18}
              style={{ color: isFullCoverage ? '#059669' : '#d97706' }}
            />
            <span>Coverage:</span>
            <strong style={{ color: isFullCoverage ? '#059669' : '#d97706' }}>
              {summary.coverage_percentage.toFixed(1)}%
            </strong>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
              ({summary.paired_count.toLocaleString()} / {summary.total_expected_periods.toLocaleString()} half-hours)
            </span>
          </div>

          {/* Target Month & Timeline */}
          <div className="freshness-item">
            <Calendar size={16} style={{ color: '#2563eb' }} />
            <span>Target Period:</span>
            <strong>January 1 – 31, 2026</strong>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>(31 Days, 48 SPs/day)</span>
          </div>

          {/* Source Provenance */}
          <div className="freshness-item">
            <Database size={16} style={{ color: '#7c3aed' }} />
            <span>Source Feeds:</span>
            <strong>Elexon BMRS WINDFOR + FUELHH</strong>
          </div>

          {/* Freshness Status */}
          <div className="freshness-item">
            <Zap size={16} style={{ color: '#0284c7' }} />
            <span>Feed State:</span>
            <span className="badge badge-emerald" style={{ textTransform: 'capitalize' }}>
              {summary.freshness}
            </span>
          </div>
        </div>

        {/* Operational Compliance Disclaimer */}
        <div className="freshness-notice">
          <Info size={14} style={{ flexShrink: 0, color: '#2563eb' }} />
          <span>
            <strong>Decision Support:</strong> Built for wholesale day-ahead energy buyers. Independent decision support, not an automated dispatch instruction.
          </span>
        </div>
      </div>

      {/* Warnings Callout if present */}
      {hasWarnings && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            color: '#b45309',
            fontSize: '0.82rem',
          }}
        >
          <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#92400e' }}>
              Evaluation Attention Notices ({summary.warnings.length}):
            </strong>
            <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.8rem' }}>
              {summary.warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
