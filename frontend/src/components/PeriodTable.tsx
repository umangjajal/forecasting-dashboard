import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  RefreshCw,
  Server,
  X,
  AlertCircle,
} from 'lucide-react';
import { EvaluationRow, EvaluationStatus } from '../types';
import { windApi } from '../api/client';

interface PeriodTableProps {
  selectedDate: string | null;
  onClearDateFilter: () => void;
  selectedGate: string;
  isDashboardLoading?: boolean;
}

export const PeriodTable: React.FC<PeriodTableProps> = ({
  selectedDate,
  onClearDateFilter,
  selectedGate,
  isDashboardLoading = false,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Backend Data State
  const [periods, setPeriods] = useState<EvaluationRow[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search term by 280ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm);
      setPage(1); // Reset to first page when search changes
    }, 280);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when gate, date, or status filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedGate, selectedDate, statusFilter]);

  // Track latest request to avoid race conditions
  const activeRequestId = useRef<number>(0);

  // Fetch from backend search API
  const fetchFromBackendSearch = useCallback(async () => {
    const requestId = ++activeRequestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await windApi.searchPeriods({
        gate: selectedGate,
        date: selectedDate || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        q: debouncedQuery.trim() ? debouncedQuery.trim() : undefined,
        page,
        limit: pageSize,
      });

      // Ignore response if another request has been started
      if (requestId === activeRequestId.current) {
        setPeriods(response.items);
        setTotalItems(response.total_items);
        setTotalPages(response.total_pages);
      }
    } catch (err: any) {
      if (requestId === activeRequestId.current) {
        console.error('Failed to fetch from backend search API:', err);
        setError(err.message || 'Unable to load records from backend search API');
      }
    } finally {
      if (requestId === activeRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [selectedGate, selectedDate, statusFilter, debouncedQuery, page, pageSize]);

  useEffect(() => {
    fetchFromBackendSearch();
  }, [fetchFromBackendSearch]);

  // Export CSV using backend search API
  const handleExportCsv = async () => {
    if (totalItems === 0) return;
    setIsExporting(true);

    try {
      // Query backend for all records matching current filters
      const allResults = await windApi.searchPeriods({
        gate: selectedGate,
        date: selectedDate || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        q: debouncedQuery.trim() ? debouncedQuery.trim() : undefined,
        page: 1,
        limit: 1500,
      });

      const exportRows = allResults.items || periods;

      const headers = [
        'Settlement Date',
        'Settlement Period',
        'Local Start Time (Europe/London)',
        'UTC Start Time',
        'Decision Cutoff (UTC)',
        'Selected Forecast Publish Time (UTC)',
        'Realized Actual (MW)',
        'Gate Forecast (MW)',
        'Signed Error (MW)',
        'Absolute Error (MW)',
        'Status',
        'Provenance',
      ];

      const csvRows = exportRows.map((r) => [
        `"${r.settlement_date}"`,
        r.settlement_period,
        `"${r.start_time_local}"`,
        `"${r.start_time_utc}"`,
        `"${r.decision_cutoff_utc}"`,
        `"${r.selected_publish_time_utc || 'NONE'}"`,
        r.actual_generation_mw !== null ? r.actual_generation_mw.toFixed(2) : '',
        r.forecast_generation_mw !== null ? r.forecast_generation_mw.toFixed(2) : '',
        r.signed_error_mw !== null ? r.signed_error_mw.toFixed(2) : '',
        r.absolute_error_mw !== null ? r.absolute_error_mw.toFixed(2) : '',
        `"${r.status}"`,
        `"${r.provenance}"`,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      const filename = `uk_wind_eval_${selectedGate}_${selectedDate || 'jan2026_full'}.csv`;
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Export CSV error:', err);
      alert('Could not export CSV: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: EvaluationStatus) => {
    switch (status) {
      case 'matched':
        return <span className="badge badge-emerald">Matched</span>;
      case 'forecast_missing_at_cutoff':
        return <span className="badge badge-rose">Missing Forecast</span>;
      case 'actual_missing':
        return <span className="badge badge-rose">Missing Actual</span>;
      case 'conflicting_source_rows':
        return <span className="badge badge-amber">Conflict</span>;
      default:
        return <span className="badge badge-slate">{status}</span>;
    }
  };

  const showLoading = isLoading || isDashboardLoading;

  return (
    <div className="table-container" role="region" aria-label="Half-Hourly Settlement Periods Evaluation">
      {/* Table Header & Toolbar */}
      <div className="table-header-bar">
        <div>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Table size={18} style={{ color: '#2563eb' }} />
            Half-Hourly Settlement Period Audit Log
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.15rem' }}>
            Full granularity: Realized actuals vs gate forecast vintage, publication timestamps, and signed error MW.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Active Backend Search Status Badge */}
          <span
            className="filter-loading-pill"
            style={{
              backgroundColor: showLoading ? '#eff6ff' : '#f8fafc',
              borderColor: showLoading ? '#bfdbfe' : '#e2e8f0',
              color: showLoading ? '#2563eb' : '#64748b',
            }}
          >
            <Server size={13} style={{ color: showLoading ? '#2563eb' : '#64748b' }} />
            <span>{showLoading ? 'Querying Backend...' : 'Backend Search API'}</span>
          </span>

          {selectedDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="badge badge-blue">Day: {selectedDate}</span>
              <button
                className="btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                onClick={onClearDateFilter}
                title="Show all days in month"
              >
                <RotateCcw size={12} style={{ marginRight: '4px' }} />
                All Days
              </button>
            </div>
          )}

          {/* Export CSV Button */}
          <button
            className="btn-secondary"
            onClick={handleExportCsv}
            disabled={totalItems === 0 || isExporting}
            title="Download currently filtered records as CSV via backend API"
          >
            {isExporting ? (
              <RefreshCw size={14} className="animate-spin" style={{ color: '#2563eb' }} />
            ) : (
              <Download size={15} style={{ color: '#059669' }} />
            )}
            <span>{isExporting ? 'Exporting...' : `Export CSV (${totalItems.toLocaleString()})`}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar with Live Loading Indicators */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          padding: '0.75rem 1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Input with Backend Trigger & Spinner */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {showLoading ? (
              <RefreshCw
                size={14}
                className="animate-spin"
                style={{ position: 'absolute', left: '0.75rem', color: '#2563eb' }}
              />
            ) : (
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', color: '#64748b' }} />
            )}
            <input
              type="text"
              className="table-search-input"
              placeholder="Backend Search (e.g. SP24, 2026-01-15, matched)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search periods via backend API"
              style={{ paddingLeft: '2.25rem', paddingRight: searchTerm ? '2rem' : '1rem' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={14} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>Status:</span>
            <select
              className="gate-select"
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.45rem 1.75rem 0.45rem 0.75rem',
                fontSize: '0.82rem',
              }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by period alignment status"
            >
              <option value="all">All Records</option>
              <option value="matched">Matched Only</option>
              <option value="missing">Any Missing</option>
              <option value="forecast_missing_at_cutoff">Missing Forecast at Cutoff</option>
              <option value="actual_missing">Missing Actual</option>
            </select>
          </div>

          {/* Live Filter Loading Indicator Pill */}
          {showLoading && (
            <div className="filter-loading-pill animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              <span>Filtering Backend Records...</span>
            </div>
          )}
        </div>

        {/* Page Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          <span>Show:</span>
          <select
            className="gate-select"
            style={{
              backgroundColor: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '6px',
              padding: '0.45rem 1.75rem 0.45rem 0.75rem',
              fontSize: '0.82rem',
            }}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Items per page"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Error Message if search fails */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            margin: '0.75rem 0',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            className="btn-secondary"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
            onClick={fetchFromBackendSearch}
          >
            Retry Search
          </button>
        </div>
      )}

      {/* Table Content Area with Loading State */}
      <div className="table-wrapper-relative" style={{ overflowX: 'auto' }}>
        {showLoading && (
          <div className="table-loading-overlay">
            <RefreshCw size={26} className="animate-spin" style={{ color: '#2563eb' }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e3a8a' }}>
              Querying backend search API...
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Applying server-side filters for Gate: {selectedGate}
              {selectedDate ? ` • Date: ${selectedDate}` : ''}
              {debouncedQuery ? ` • Query: "${debouncedQuery}"` : ''}
              {statusFilter !== 'all' ? ` • Status: ${statusFilter}` : ''}
            </div>
          </div>
        )}

        <table className="clean-table" style={{ opacity: showLoading ? 0.45 : 1, transition: 'opacity 0.2s ease' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ textAlign: 'center' }}>SP</th>
              <th>Local Time (UK)</th>
              <th>UTC Time</th>
              <th style={{ textAlign: 'right' }}>Realized Actual</th>
              <th style={{ textAlign: 'right' }}>Cutoff Forecast</th>
              <th style={{ textAlign: 'right' }}>Signed Error</th>
              <th style={{ textAlign: 'right' }}>Abs Error</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th>Selected Publish Time (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && !showLoading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  No half-hourly periods match the backend search filters.
                </td>
              </tr>
            ) : (
              periods.map((row) => {
                const signedErr = row.signed_error_mw;
                const isOver = signedErr !== null && signedErr > 0;
                const isUnder = signedErr !== null && signedErr < 0;

                return (
                  <tr key={`${row.settlement_date}-${row.settlement_period}`}>
                    <td className="font-mono" style={{ color: '#0f172a', fontWeight: 600 }}>
                      {row.settlement_date}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>
                      {row.settlement_period}
                    </td>
                    <td className="font-mono" style={{ color: '#0f172a' }}>
                      {row.start_time_local.substring(11, 16)}
                    </td>
                    <td className="font-mono" style={{ color: '#64748b', fontSize: '0.78rem' }}>
                      {row.start_time_utc.substring(11, 16)}Z
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                      {row.actual_generation_mw !== null ? (
                        `${row.actual_generation_mw.toLocaleString('en-GB', { maximumFractionDigits: 1 })} MW`
                      ) : (
                        <span style={{ color: '#dc2626' }}>Missing</span>
                      )}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                      {row.forecast_generation_mw !== null ? (
                        `${row.forecast_generation_mw.toLocaleString('en-GB', { maximumFractionDigits: 1 })} MW`
                      ) : (
                        <span style={{ color: '#dc2626' }}>Missing</span>
                      )}
                    </td>
                    <td
                      className="font-mono"
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: isOver ? '#d97706' : isUnder ? '#dc2626' : '#64748b',
                      }}
                    >
                      {signedErr !== null
                        ? `${signedErr > 0 ? '+' : ''}${signedErr.toLocaleString('en-GB', { maximumFractionDigits: 1 })}`
                        : '—'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#475569' }}>
                      {row.absolute_error_mw !== null
                        ? row.absolute_error_mw.toLocaleString('en-GB', { maximumFractionDigits: 1 })
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>{getStatusBadge(row.status)}</td>
                    <td
                      className="font-mono"
                      style={{ fontSize: '0.78rem', color: row.selected_publish_time_utc ? '#334155' : '#94a3b8' }}
                    >
                      {row.selected_publish_time_utc || 'None before cutoff'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Server-Side Pagination Bar */}
      <div className="pagination-bar">
        <div>
          Showing{' '}
          <strong style={{ color: '#0f172a' }}>
            {totalItems === 0 ? 0 : (page - 1) * pageSize + 1}
          </strong>{' '}
          to{' '}
          <strong style={{ color: '#0f172a' }}>
            {Math.min(page * pageSize, totalItems)}
          </strong>{' '}
          of <strong style={{ color: '#0f172a' }}>{totalItems.toLocaleString()}</strong> periods{' '}
          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>(Server-Paginated)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            className="pagination-btn"
            onClick={() => setPage(1)}
            disabled={page <= 1 || showLoading}
            title="First page"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || showLoading}
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          <span style={{ padding: '0 0.5rem', fontSize: '0.8rem', color: '#475569' }}>
            Page <strong style={{ color: '#0f172a' }}>{page}</strong> of{' '}
            <strong style={{ color: '#0f172a' }}>{totalPages}</strong>
          </span>

          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || showLoading}
            title="Next page"
          >
            <ChevronRight size={14} />
          </button>
          <button
            className="pagination-btn"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || showLoading}
            title="Last page"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
