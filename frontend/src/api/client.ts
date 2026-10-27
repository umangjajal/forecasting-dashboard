/**
 * UK National Wind Forecast Evaluation Portal — API Client
 */

import {
  DecisionGate,
  SummaryResponse,
  DailySummary,
  EvaluationRow,
  PeriodsResponse,
  RefreshStatus,
  HealthResponse
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data && data.detail) {
        errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // Ignore fallback
    }
    throw new ApiError(errorDetail, response.status);
  }
  return response.json();
}

export const windApi = {
  /**
   * Fetch all configured decision gates (e.g. 12:00 D-1, 09:00 D-1, etc.)
   */
  async getGates(): Promise<DecisionGate[]> {
    const res = await fetch(`${API_BASE_URL}/api/wind/gates`);
    return handleResponse<DecisionGate[]>(res);
  },

  /**
   * Fetch monthly aggregated error metrics
   */
  async getSummary(month = '2026-01', gate = 'd1_1200'): Promise<SummaryResponse> {
    const query = new URLSearchParams({ month, gate });
    const res = await fetch(`${API_BASE_URL}/api/wind/summary?${query.toString()}`);
    return handleResponse<SummaryResponse>(res);
  },

  /**
   * Fetch day-by-day metrics across January 2026
   */
  async getDailySummaries(month = '2026-01', gate = 'd1_1200'): Promise<DailySummary[]> {
    const query = new URLSearchParams({ month, gate });
    const res = await fetch(`${API_BASE_URL}/api/wind/daily?${query.toString()}`);
    return handleResponse<DailySummary[]>(res);
  },

  /**
   * Fetch full aligned timeseries for charting
   */
  async getTimeseries(
    gate = 'd1_1200',
    fromDate?: string,
    toDate?: string
  ): Promise<EvaluationRow[]> {
    const query = new URLSearchParams({ gate });
    if (fromDate) query.append('from', fromDate);
    if (toDate) query.append('to', toDate);
    const res = await fetch(`${API_BASE_URL}/api/wind/timeseries?${query.toString()}`);
    return handleResponse<EvaluationRow[]>(res);
  },

  /**
   * Fetch paginated half-hour periods with server-side search and filtering
   */
  async getPeriods(params: {
    q?: string;
    date?: string;
    gate?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PeriodsResponse> {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.date) query.append('date', params.date);
    if (params.gate) query.append('gate', params.gate);
    if (params.fromDate) query.append('from', params.fromDate);
    if (params.toDate) query.append('to', params.toDate);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const res = await fetch(`${API_BASE_URL}/api/wind/periods?${query.toString()}`);
    return handleResponse<PeriodsResponse>(res);
  },

  /**
   * Dedicated Backend Search API for settlement periods
   */
  async searchPeriods(params: {
    q?: string;
    date?: string;
    gate?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PeriodsResponse> {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.date) query.append('date', params.date);
    if (params.gate) query.append('gate', params.gate);
    if (params.fromDate) query.append('from', params.fromDate);
    if (params.toDate) query.append('to', params.toDate);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const res = await fetch(`${API_BASE_URL}/api/wind/search?${query.toString()}`);
    return handleResponse<PeriodsResponse>(res);
  },

  /**
   * Get background ingestion status
   */
  async getRefreshStatus(): Promise<RefreshStatus> {
    const res = await fetch(`${API_BASE_URL}/api/wind/refresh-status`);
    return handleResponse<RefreshStatus>(res);
  },

  /**
   * Trigger data refresh from Elexon BMRS
   */
  async triggerRefresh(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/wind/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<{ status: string; message: string }>(res);
  },

  /**
   * Check system health & database connection
   */
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    return handleResponse<HealthResponse>(res);
  },
};
