import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { windApi } from './api/client';
import {
  DecisionGate,
  SummaryResponse,
  DailySummary,
  EvaluationRow,
  RefreshStatus,
} from './types';
import { Header } from './components/Header';
import { FreshnessBanner } from './components/FreshnessBanner';
import { KpiCards } from './components/KpiCards';
import { WindComparisonChart } from './components/WindComparisonChart';
import { DailySummaryTable } from './components/DailySummaryTable';
import { PeriodTable } from './components/PeriodTable';
import { MethodologyModal } from './components/MethodologyModal';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // Gate and Filter State
  const [gates, setGates] = useState<DecisionGate[]>([]);
  const [selectedGate, setSelectedGate] = useState<string>('d1_1200');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Data State
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [timeseries, setTimeseries] = useState<EvaluationRow[]>([]);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState<boolean>(false);

  // Initial load of gates
  useEffect(() => {
    async function loadGates() {
      try {
        const availableGates = await windApi.getGates();
        if (availableGates && availableGates.length > 0) {
          setGates(availableGates);
        }
      } catch (err: any) {
        console.warn('Could not load dynamic gates, using default fallback:', err);
        setGates([
          {
            id: 'd1_1200',
            name: '12:00 D-1 Gate',
            cutoff_time: '12:00',
            day_offset: -1,
            description: 'Benchmark day-ahead procurement gate at 12:00 local time',
          },
          {
            id: 'd1_0900',
            name: '09:00 D-1 Gate',
            cutoff_time: '09:00',
            day_offset: -1,
            description: 'Early morning day-ahead planning auction gate',
          },
          {
            id: 'd1_1700',
            name: '17:00 D-1 Gate',
            cutoff_time: '17:00',
            day_offset: -1,
            description: 'Late afternoon power exchange nomination gate',
          },
          {
            id: 'd1_2300',
            name: '23:00 D-1 Gate',
            cutoff_time: '23:00',
            day_offset: -1,
            description: 'Final overnight day-ahead gate before delivery',
          },
        ]);
      }
    }
    loadGates();
  }, []);

  // Fetch evaluation dataset whenever selectedGate changes
  const loadEvaluationData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, dailyRes, seriesRes, statusRes] = await Promise.all([
        windApi.getSummary('2026-01', selectedGate),
        windApi.getDailySummaries('2026-01', selectedGate),
        windApi.getTimeseries(selectedGate),
        windApi.getRefreshStatus().catch(() => null),
      ]);

      setSummary(sumRes);
      setDailySummaries(dailyRes);
      setTimeseries(seriesRes);
      if (statusRes) setRefreshStatus(statusRes);
    } catch (err: any) {
      console.error('Failed to load wind evaluation dataset:', err);
      setError(
        err.message || 'Unable to connect to the evaluation API. Verify backend service is running on port 8000.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedGate]);

  useEffect(() => {
    loadEvaluationData();
  }, [loadEvaluationData]);

  // Handle Refresh Trigger & Polling
  const handleTriggerRefresh = async () => {
    try {
      setIsRefreshing(true);
      await windApi.triggerRefresh();
      const pollInterval = setInterval(async () => {
        try {
          const status = await windApi.getRefreshStatus();
          setRefreshStatus(status);
          if (status.state === 'success' || status.state === 'failed' || status.state === 'idle') {
            clearInterval(pollInterval);
            setIsRefreshing(false);
            await loadEvaluationData();
          }
        } catch {
          clearInterval(pollInterval);
          setIsRefreshing(false);
        }
      }, 2000);
    } catch (err: any) {
      console.error('Failed to trigger refresh:', err);
      setIsRefreshing(false);
    }
  };

  // Distinct dates for quick filters
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    dailySummaries.forEach((d) => dates.add(d.date));
    return Array.from(dates).sort();
  }, [dailySummaries]);

  return (
    <div className="app-container">
      {/* Top Header Navigation */}
      <Header
        gates={gates}
        selectedGate={selectedGate}
        onGateChange={(newGate) => {
          setSelectedGate(newGate);
        }}
        refreshStatus={refreshStatus}
        onTriggerRefresh={handleTriggerRefresh}
        isRefreshing={isRefreshing}
        onOpenMethodology={() => setIsMethodologyOpen(true)}
        isLoading={isLoading}
      />

      {/* Error Banner with Retry */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            color: '#991b1b',
          }}
          role="alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.9rem', color: '#7f1d1d' }}>Connection Alert:</strong>
              <p style={{ marginTop: '0.15rem', fontSize: '0.82rem', color: '#b91c1c' }}>{error}</p>
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            onClick={loadEvaluationData}
          >
            <RefreshCw size={14} />
            <span>Retry Feed</span>
          </button>
        </div>
      )}

      {/* Freshness, Coverage & Provenance Banner */}
      <FreshnessBanner summary={summary} />

      {/* Loading Skeleton Indicator */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '2rem',
            color: '#2563eb',
            fontSize: '0.88rem',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <RefreshCw size={18} className="animate-spin" />
          <span style={{ fontWeight: 500 }}>
            Aligning national wind outturn and D-1 forecast vintages for January 2026...
          </span>
        </div>
      )}

      {/* KPI Cards Grid with Clean Light Theme & Prominent Icons */}
      <KpiCards summary={summary} isLoading={isLoading} />

      {/* Day-by-Day Aggregation & Drill-Down Table */}
      <DailySummaryTable
        dailySummaries={dailySummaries}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        isLoading={isLoading}
      />

      {/* Visual Actuals vs Forecast Timeseries Chart */}
      <WindComparisonChart
        data={timeseries}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        availableDates={availableDates}
        isLoading={isLoading}
      />

      {/* Half-Hourly Settlement Period Table & Backend Search API */}
      <PeriodTable
        selectedDate={selectedDate}
        onClearDateFilter={() => setSelectedDate(null)}
        selectedGate={selectedGate}
        isDashboardLoading={isLoading}
      />

      {/* Methodology & Audit Modal */}
      <MethodologyModal
        isOpen={isMethodologyOpen}
        onClose={() => setIsMethodologyOpen(false)}
      />

      {/* Footer */}
      <footer
        style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.78rem',
          color: '#64748b',
        }}
      >
        <div>
          <span style={{ fontWeight: 600, color: '#334155' }}>
            National Wind Generation Forecast Evaluation Portal
          </span>
          <span style={{ margin: '0 0.5rem' }}>•</span>
          <span>January 2026 Historical Replay</span>
          <span style={{ margin: '0 0.5rem' }}>•</span>
          <span>Elexon BMRS Verified</span>
        </div>
        <div>
          <span>Timezone: Europe/London (GMT) with aware UTC normalization</span>
          <span style={{ margin: '0 0.5rem' }}>•</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>Operational Decision Support</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
