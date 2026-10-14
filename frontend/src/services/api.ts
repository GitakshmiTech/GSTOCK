import {
  MarketOverviewData,
  StockExplorerData,
  SeasonalityData,
  ComparisonData,
  IngestionJob,
  SecurityMasterItem,
  AuthUser,
  ScreenDefinition,
  DailyMarketResponse,
  BhavcopyImportResult,
  LatestAvailableDateInfo,
  IngestedFileItem,
} from '../types';

const API_BASE = ''; // Relies on Vite proxy or same-host deployment


function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('nse_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function loginUser(emailOrUsername: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailOrUsername, username: emailOrUsername, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Unauthorized or session expired');
  }
  return res.json();
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch (e) {
    console.error('Logout error:', e);
  } finally {
    localStorage.removeItem('nse_auth_token');
    localStorage.removeItem('nse_user_profile');
  }
}

export async function fetchScreens(): Promise<ScreenDefinition[]> {
  const res = await fetch(`${API_BASE}/api/v1/users/screens`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch screen definitions');
  return res.json();
}

export async function fetchUsers(): Promise<AuthUser[]> {
  const res = await fetch(`${API_BASE}/api/v1/users`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch users' }));
    throw new Error(err.detail || 'Failed to fetch users');
  }
  return res.json();
}

export async function createUser(userData: {
  email?: string;
  username?: string;
  password: string;
  full_name?: string;
  role: string;
  accessible_screens: string[];
  is_active?: boolean;
}): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/v1/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create user' }));
    throw new Error(err.detail || 'Failed to create user');
  }
  return res.json();
}

export async function updateUser(
  userId: number,
  userData: {
    email?: string;
    full_name?: string;
    password?: string;
    role?: string;
    accessible_screens?: string[];
    is_active?: boolean;
  }
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update user' }));
    throw new Error(err.detail || 'Failed to update user');
  }
  return res.json();
}

export async function deleteUser(userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete user' }));
    throw new Error(err.detail || 'Failed to delete user');
  }
}

export async function fetchSecurities(
  q: string = '',
  limit: number = 5000,
  sharesOnly: boolean = true
): Promise<SecurityMasterItem[]> {
  const params = new URLSearchParams({
    q,
    limit: limit.toString(),
    shares_only: sharesOnly.toString(),
  });
  const res = await fetch(`${API_BASE}/api/v1/securities?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch securities');
  return res.json();
}

export async function fetchMarketOverview(): Promise<MarketOverviewData> {
  const res = await fetch(`${API_BASE}/api/v1/dashboard/summary`);
  if (!res.ok) throw new Error('Failed to fetch market overview');
  return res.json();
}

export async function fetchStockPrices(
  symbol: string,
  start?: string,
  end?: string,
  series: string = 'EQ'
): Promise<StockExplorerData> {
  const params = new URLSearchParams({ series });
  if (start) params.set('start', start);
  if (end) params.set('end', end);

  const res = await fetch(`${API_BASE}/api/v1/stocks/${symbol.toUpperCase()}/prices?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch prices for ${symbol}`);
  return res.json();
}

export async function fetchSeasonality(
  symbol: string,
  series: string = 'EQ',
  startYear?: number,
  endYear?: number,
  startDate?: string,
  endDate?: string
): Promise<SeasonalityData> {
  const params = new URLSearchParams({ series });
  if (startYear !== undefined && startYear !== null) params.set('start_year', startYear.toString());
  if (endYear !== undefined && endYear !== null) params.set('end_year', endYear.toString());
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const res = await fetch(`${API_BASE}/api/v1/analytics/seasonality/${symbol.toUpperCase()}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch seasonality for ${symbol}`);
  return res.json();
}

export async function fetchStockComparison(
  symbols: string[],
  start?: string,
  end?: string,
  series: string = 'EQ'
): Promise<ComparisonData> {
  const params = new URLSearchParams({ symbols: symbols.join(','), series });
  if (start) params.set('start', start);
  if (end) params.set('end', end);

  const res = await fetch(`${API_BASE}/api/v1/analytics/compare?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch stock comparison');
  return res.json();
}

export async function fetchIngestionJobs(): Promise<IngestionJob[]> {
  const res = await fetch(`${API_BASE}/api/v1/ingestion/jobs`);
  if (!res.ok) throw new Error('Failed to fetch ingestion jobs');
  return res.json();
}

export interface SchedulerStatus {
  status: string;
  configured_time: string;
  timezone: string;
  next_run_time: string;
  misfire_grace_hours: number;
}

export async function fetchSchedulerStatus(): Promise<SchedulerStatus> {
  const res = await fetch(`${API_BASE}/api/v1/scheduler/status`);
  if (!res.ok) throw new Error('Failed to fetch scheduler status');
  return res.json();
}

export async function triggerDailyUpdate(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/daily-update`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger daily update');
  return res.json();
}

export interface DailyMarketParams {
  trade_date?: string;
  series?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  filter_type?: string;
  limit?: number;
  page?: number;
}

export async function fetchDailyMarketOHLC(params: DailyMarketParams = {}): Promise<DailyMarketResponse> {
  const query = new URLSearchParams();
  if (params.trade_date) query.set('trade_date', params.trade_date);
  if (params.series) query.set('series', params.series);
  if (params.search) query.set('search', params.search);
  if (params.sort_by) query.set('sort_by', params.sort_by);
  if (params.sort_order) query.set('sort_order', params.sort_order);
  if (params.filter_type) query.set('filter_type', params.filter_type);
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.page) query.set('page', params.page.toString());

  const res = await fetch(`${API_BASE}/api/v1/prices/daily-market?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch daily market prices');
  return res.json();
}

export async function fetchLatestAvailableDate(): Promise<LatestAvailableDateInfo> {
  const res = await fetch(`${API_BASE}/api/v1/ingestion/latest-available-date`);
  if (!res.ok) throw new Error('Failed to fetch latest available date info');
  return res.json();
}

export async function downloadAndImportBhavcopy(
  tradeDate?: string,
  force: boolean = false
): Promise<BhavcopyImportResult> {
  const res = await fetch(`${API_BASE}/api/v1/ingestion/download-and-import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      trade_date: tradeDate || null,
      force,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to download and import Bhavcopy' }));
    throw new Error(err.detail || err.message || 'Failed to download and import Bhavcopy');
  }
  return res.json();
}

export async function fetchIngestedFiles(limit: number = 50): Promise<IngestedFileItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/ingestion/files?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch ingested files log');
  return res.json();
}


