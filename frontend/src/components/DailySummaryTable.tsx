import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Filter,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { DailySummary } from '../types';

interface DailySummaryTableProps {
  dailySummaries: DailySummary[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  isLoading?: boolean;
}

type SortColumn =
  | 'date'
  | 'paired_count'
  | 'mae_mw'
  | 'rmse_mw'
  | 'mean_bias_mw'
  | 'wape_percentage'
  | 'actual_energy_gwh';

export const DailySummaryTable: React.FC<DailySummaryTableProps> = ({
  dailySummaries,
  selectedDate,
  onSelectDate,
  isLoading = false,
}) => {
  const [sortCol, setSortCol] = useState<SortColumn>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Keyboard shortcut: Press Escape to exit single-day focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDate) {
        onSelectDate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate, onSelectDate]);

  const handleSort = (col: SortColumn, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(col === 'date' ? true : false);
    }
  };

  const getDayOfWeek = (dateStr: string): string => {
    try {
      const date = new Date(dateStr + 'T00:00:00Z');
      return date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    } catch {
      return '';
    }
  };

  const sortedSummaries = useMemo(() => {
    return [...dailySummaries].sort((a, b) => {
      let valA: any = a[sortCol];
      let valB: any = b[sortCol];

      if (valA === null || valA === undefined) valA = -999999;
      if (valB === null || valB === undefined) valB = -999999;

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [dailySummaries, sortCol, sortAsc]);

  // When a day is selected, DISAPPEAR all the other rows so user gets a focused view
  const displayedSummaries = useMemo(() => {
    if (selectedDate) {
      const matched = sortedSummaries.filter((d) => d.date === selectedDate);
      return matched.length > 0 ? matched : sortedSummaries;
    }
    return sortedSummaries;
  }, [sortedSummaries, selectedDate]);

  // All dates sorted for previous/next navigation while in focus mode
  const allDates = useMemo(() => {
    return [...dailySummaries].map((d) => d.date).sort();
  }, [dailySummaries]);

  const currentIndex = selectedDate ? allDates.indexOf(selectedDate) : -1;
  const prevDate = currentIndex > 0 ? allDates[currentIndex - 1] : null;
  const nextDate =
    currentIndex >= 0 && currentIndex < allDates.length - 1 ? allDates[currentIndex + 1] : null;

  const renderSortIcon = (col: SortColumn) => {
    if (sortCol !== col) {
      return <ArrowUpDown size={12} style={{ color: '#94a3b8', marginLeft: '4px' }} />;
    }
    return sortAsc ? (
      <ArrowUp size={12} style={{ color: '#2563eb', marginLeft: '4px' }} />
    ) : (
      <ArrowDown size={12} style={{ color: '#2563eb', marginLeft: '4px' }} />
    );
  };

  const handleRowClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      // Clicking the already focused day clears focus and restores all 31 days
      onSelectDate(null);
    } else {
      // Disappear all other days and isolate this selected day
      onSelectDate(dateStr);

      // Smoothly scroll down to the graph so the user immediately sees the inspected day
      setTimeout(() => {
        const graphEl = document.getElementById('wind-comparison-graph');
        if (graphEl) {
          graphEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  };

  return (
    <div className="table-container" role="region" aria-label="January 2026 Daily Evaluation Breakdown">
      {/* Table Header Bar */}
      <div className="table-header-bar">
        <div>
          <h3
            style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Calendar size={20} style={{ color: '#2563eb' }} />
            {selectedDate
              ? `January 2026 Day-by-Day Accuracy Matrix • Single Day Focus`
              : `January 2026 Day-by-Day Accuracy Matrix`}
          </h3>
          <p
            style={{
              fontSize: '0.84rem',
              color: '#64748b',
              marginTop: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Sparkles size={14} style={{ color: '#2563eb' }} />
            <span>
              {selectedDate ? (
                <>
                  Inspecting <strong>{selectedDate}</strong>. All other 30 days are hidden for clear focus. Click the row or button to restore full month.
                </>
              ) : (
                <>
                  Click <strong>any row</strong> to isolate that day and inspect in the graph below.
                </>
              )}
            </span>
          </p>
        </div>

        {/* Header Right Action Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {isLoading && (
            <span className="filter-loading-pill animate-pulse">
              <RotateCcw size={12} className="animate-spin" />
              <span>Updating Days...</span>
            </span>
          )}

          {selectedDate ? (
            <button
              className="btn-primary"
              style={{
                padding: '0.45rem 0.95rem',
                fontSize: '0.82rem',
                backgroundColor: '#2563eb',
                borderColor: '#2563eb',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDate(null);
              }}
              title="Show all 31 days in January 2026 (or press Escape)"
            >
              <RotateCcw size={14} />
              <span>Show All 31 Days</span>
            </button>
          ) : (
            <span
              className="badge badge-slate"
              style={{
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Maximize2 size={12} style={{ color: '#2563eb' }} />
              All 31 Days Visible
            </span>
          )}
        </div>
      </div>

      {/* Focus Mode Highlight Banner when a Day is Clicked */}
      {selectedDate && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            backgroundColor: '#eff6ff',
            border: '1.5px solid #bfdbfe',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '6px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <Filter size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.92rem', color: '#1e3a8a' }}>
                  Focus Mode: {selectedDate} ({getDayOfWeek(selectedDate)})
                </strong>
                <span
                  className="badge badge-blue"
                  style={{ fontSize: '0.75rem', backgroundColor: '#dbeafe', color: '#1d4ed8' }}
                >
                  Day {parseInt(selectedDate.split('-')[2], 10)} of 31
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '0.15rem' }}>
                Other 30 days are hidden for a clean, non-distracting inspection. Graph and audit log below are focused on this day.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {prevDate && (
              <button
                className="btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDate(prevDate);
                }}
                title={`Inspect previous day (${prevDate})`}
              >
                <ChevronLeft size={13} style={{ marginRight: '2px' }} />
                Prev ({prevDate.substring(5)})
              </button>
            )}

            {nextDate && (
              <button
                className="btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDate(nextDate);
                }}
                title={`Inspect next day (${nextDate})`}
              >
                Next ({nextDate.substring(5)})
                <ChevronRight size={13} style={{ marginLeft: '2px' }} />
              </button>
            )}

            <button
              className="btn-secondary"
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                color: '#1e3a8a',
                borderColor: '#bfdbfe',
                backgroundColor: '#ffffff',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDate(null);
              }}
              title="Show all 31 days (Esc)"
            >
              <RotateCcw size={12} style={{ marginRight: '4px' }} />
              Exit Focus (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="clean-table">
          <thead>
            <tr>
              <th onClick={(e) => handleSort('date', e)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  Settlement Date {renderSortIcon('date')}
                </div>
              </th>
              <th>Weekday</th>
              <th onClick={(e) => handleSort('paired_count', e)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  Coverage {renderSortIcon('paired_count')}
                </div>
              </th>
              <th onClick={(e) => handleSort('mae_mw', e)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  MAE (MW) {renderSortIcon('mae_mw')}
                </div>
              </th>
              <th onClick={(e) => handleSort('rmse_mw', e)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  RMSE (MW) {renderSortIcon('rmse_mw')}
                </div>
              </th>
              <th onClick={(e) => handleSort('mean_bias_mw', e)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Bias (MW) {renderSortIcon('mean_bias_mw')}
                </div>
              </th>
              <th onClick={(e) => handleSort('wape_percentage', e)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  WAPE (%) {renderSortIcon('wape_percentage')}
                </div>
              </th>
              <th onClick={(e) => handleSort('actual_energy_gwh', e)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Actual Energy {renderSortIcon('actual_energy_gwh')}
                </div>
              </th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {displayedSummaries.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No daily summary records available.
                </td>
              </tr>
            ) : (
              displayedSummaries.map((day) => {
                const isSelected = selectedDate === day.date;
                const isFullCoverage = day.coverage_percentage >= 99.9;
                const bias = day.mean_bias_mw ?? 0;

                return (
                  <tr
                    key={day.date}
                    onClick={() => handleRowClick(day.date)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#eff6ff' : undefined,
                      borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                    title={
                      isSelected
                        ? `Click to exit focus mode and show all 31 days`
                        : `Click to isolate ${day.date} and inspect in the graph below`
                    }
                  >
                    <td className="font-mono" style={{ fontWeight: 700, color: isSelected ? '#2563eb' : '#0f172a' }}>
                      {day.date}
                    </td>
                    <td style={{ color: '#475569', fontWeight: 500 }}>{getDayOfWeek(day.date)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isFullCoverage ? (
                          <CheckCircle size={14} style={{ color: '#059669' }} />
                        ) : (
                          <AlertTriangle size={14} style={{ color: '#d97706' }} />
                        )}
                        <span className="font-mono" style={{ fontSize: '0.78rem' }}>
                          {day.paired_count}/{day.expected_periods} ({day.coverage_percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#2563eb', fontWeight: 700 }}>
                      {day.mae_mw !== null ? day.mae_mw.toFixed(1) : 'N/A'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>
                      {day.rmse_mw !== null ? day.rmse_mw.toFixed(1) : 'N/A'}
                    </td>
                    <td
                      className="font-mono"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: Math.abs(bias) < 0.1 ? '#64748b' : bias > 0 ? '#d97706' : '#dc2626',
                      }}
                    >
                      {day.mean_bias_mw !== null
                        ? `${bias > 0 ? '+' : ''}${bias.toFixed(1)}`
                        : 'N/A'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#059669', fontWeight: 700 }}>
                      {day.wape_percentage !== null ? `${day.wape_percentage.toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#0f172a', fontWeight: 500 }}>
                      {day.actual_energy_gwh !== null ? `${day.actual_energy_gwh.toFixed(1)} GWh` : 'N/A'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-secondary"
                        style={{
                          padding: '0.35rem 0.8rem',
                          fontSize: '0.75rem',
                          backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#334155',
                          borderColor: isSelected ? '#2563eb' : '#cbd5e1',
                          fontWeight: 600,
                          pointerEvents: 'none', // so row click handles everything cleanly
                        }}
                      >
                        {isSelected ? (
                          <>
                            <RotateCcw size={12} style={{ marginRight: '4px' }} />
                            Exit Focus
                          </>
                        ) : (
                          <>
                            <Eye size={12} style={{ marginRight: '4px' }} />
                            Focus & Inspect
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
