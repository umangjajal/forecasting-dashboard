import React, { useState, useEffect } from 'react';
import { Wind, Clock, RefreshCw, BookOpen, Layers, CheckCircle, AlertTriangle } from 'lucide-react';
import { DecisionGate, RefreshStatus } from '../types';

interface HeaderProps {
  gates: DecisionGate[];
  selectedGate: string;
  onGateChange: (gateId: string) => void;
  refreshStatus: RefreshStatus | null;
  onTriggerRefresh: () => void;
  isRefreshing: boolean;
  onOpenMethodology: () => void;
  isLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  gates,
  selectedGate,
  onGateChange,
  refreshStatus,
  onTriggerRefresh,
  isRefreshing,
  onOpenMethodology,
  isLoading = false,
}) => {
  const [currentUtcTime, setCurrentUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentUtcTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentGate = gates.find((g) => g.id === selectedGate);

  return (
    <header className="header-container" role="banner">
      <div className="header-title-block">
        <div className="header-title">
          <div className="header-logo-icon">
            <Wind size={24} />
          </div>
          <span>UK National Wind Forecast Evaluation</span>
        </div>
        <div className="header-badge-row">
          <span className="badge badge-blue">
            January 2026 Replay
          </span>
          <span className="badge badge-emerald">
            Elexon BMRS Verified
          </span>
          <span className="header-subtitle font-mono">
            <Clock size={13} style={{ color: '#64748b' }} />
            <span>{currentUtcTime}</span>
          </span>
        </div>
      </div>

      <div className="header-actions">
        {/* Decision Gate Selector */}
        <div className="gate-select-wrapper" title="Select UK Day-Ahead Procurement Decision Cutoff">
          {isLoading ? (
            <RefreshCw size={16} className="gate-select-icon animate-spin" style={{ color: '#2563eb' }} />
          ) : (
            <Layers size={16} className="gate-select-icon" />
          )}
          <select
            className="gate-select font-mono"
            value={selectedGate}
            onChange={(e) => onGateChange(e.target.value)}
            disabled={isLoading}
            aria-label="Select Decision Cutoff Gate"
          >
            {gates.length > 0 ? (
              gates.map((gate) => (
                <option key={gate.id} value={gate.id}>
                  Gate: {gate.name} ({gate.cutoff_time} D{gate.day_offset})
                </option>
              ))
            ) : (
              <option value="d1_1200">12:00 D-1 (EPEX SPOT Auction)</option>
            )}
          </select>
        </div>

        {isLoading && (
          <div className="filter-loading-pill animate-pulse">
            <RefreshCw size={12} className="animate-spin" />
            <span>Loading Gate...</span>
          </div>
        )}

        {/* Refresh Data Button */}
        <button
          className="btn-secondary"
          onClick={onTriggerRefresh}
          disabled={isRefreshing || refreshStatus?.state === 'running'}
          title="Trigger ingestion refresh from Elexon BMRS stream"
        >
          <RefreshCw
            size={16}
            className={isRefreshing || refreshStatus?.state === 'running' ? 'animate-spin' : ''}
            style={{ color: '#2563eb' }}
          />
          <span>
            {refreshStatus?.state === 'running' || isRefreshing
              ? 'Refreshing...'
              : 'Refresh Feed'}
          </span>
          {refreshStatus?.state === 'success' && (
            <CheckCircle size={14} style={{ color: '#059669' }} />
          )}
          {refreshStatus?.state === 'failed' && (
            <AlertTriangle size={14} style={{ color: '#dc2626' }} />
          )}
        </button>

        {/* Methodology Audit Modal Button */}
        <button
          className="btn-primary"
          onClick={onOpenMethodology}
          title="View evaluation methodology, formulas, and cutoff selection logic"
        >
          <BookOpen size={16} />
          <span>Methodology & Audit</span>
        </button>
      </div>

      {currentGate && (
        <div
          style={{
            width: '100%',
            fontSize: '0.8rem',
            color: '#475569',
            marginTop: '-0.25rem',
            paddingTop: '0.65rem',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <strong style={{ color: '#0f172a' }}>Active Cutoff Rule: </strong>
            <span>{currentGate.description} — Only forecasts published on or before </span>
            <strong style={{ color: '#2563eb' }}>{currentGate.cutoff_time} D-1</strong>
            <span> are eligible.</span>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
            Zero Look-Ahead Protocol: Revisions after cutoff are strictly excluded.
          </div>
        </div>
      )}
    </header>
  );
};
