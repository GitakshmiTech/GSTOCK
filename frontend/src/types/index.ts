export interface MarketMover {
  symbol: string;
  series: string;
  company_name?: string | null;
  close_price: number;
  prev_close: number;
  change?: number;
  change_pct: number;
  turnover: number;
  volume: number;
}

export interface IngestionJobSummary {
  job_id: string;
  job_type: string;
  status: string;
  total_rows: number;
  started_at?: string;
  completed_at?: string;
}

export interface MarketOverviewData {
  latest_date: string | null;
  total_securities_count: number;
  total_records_count?: number;
  traded_securities_count: number;
  advances: number;
  declines: number;
  unchanged: number;
  total_turnover: number;
  total_volume: number;
  top_gainers: MarketMover[];
  top_losers: MarketMover[];
  most_active: MarketMover[];
  latest_job: IngestionJobSummary | null;
}


export interface StockPriceRecord {
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  turnover: number;
  daily_return?: number | null;
  prev_close?: number | null;
  sma_20?: number | null;
  sma_50?: number | null;
  sma_200?: number | null;
  drawdown?: number | null;
}

export interface StockExplorerData {
  symbol: string;
  series: string;
  records_count: number;
  summary: {
    latest_close: number;
    total_return_pct: number;
    annualized_volatility_pct: number;
    max_drawdown_pct: number;
    start_date: string;
    end_date: string;
  };
  data: StockPriceRecord[];
}

export interface HeatmapRow {
  year: number;
  [key: string]: number | null | undefined;
}

export interface SeasonalityMatrixSection {
  columns: string[];
  rows: HeatmapRow[];
  average: Record<string, number>;
  median: Record<string, number>;
  win_rates: Record<string, number>;
}

export interface SeasonalityData {
  symbol: string;
  monthly_averages: Record<string, number>;
  win_rates: Record<string, { positive_pct: number; total_years: number }>;
  heatmap: HeatmapRow[];
  monthly?: SeasonalityMatrixSection;
  quarterly?: SeasonalityMatrixSection;
  weekly?: SeasonalityMatrixSection;
  weekday?: {
    columns: string[];
    average: Record<string, number>;
    median: Record<string, number>;
    win_rates: Record<string, number>;
  };
}

export interface SecurityMasterItem {
  id: number;
  symbol: string;
  series: string;
  company_name: string | null;
  isin: string | null;
  status: string;
}

export interface StockComparisonStat {
  symbol: string;
  base_price: number;
  latest_close: number;
  cumulative_return_pct: number;
  annualized_volatility_pct: number;
  max_drawdown_pct: number;
  data_points: number;
}

export interface ComparisonData {
  symbols: string[];
  summary: StockComparisonStat[];
  series: Record<string, Array<{ trade_date: string; normalized_price: number }>>;
}

export interface IngestionJob {
  job_id: string;
  job_type: string;
  status: string;
  total_dates: number;
  successful_dates: number;
  failed_dates: number;
  total_rows_imported: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email?: string | null;
  full_name: string | null;
  role: 'admin' | 'user';
  accessible_screens: string[];
  is_active: boolean;
  created_at?: string;
}

export interface ScreenDefinition {
  key: string;
  label: string;
  description: string;
}

export interface DailyMarketItem {
  id: number;
  symbol: string;
  series: string;
  company_name: string | null;
  trade_date: string;

  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  close_price: number;
  prev_close: number;
  last_price: number | null;
  vwap: number | null;
  change: number;
  change_pct: number;
  traded_quantity: number;
  turnover: number;
  turnover_cr: number;
}

export interface DailyMarketSummary {
  total_stocks: number;
  advances: number;
  declines: number;
  unchanged: number;
  total_turnover_cr: number;
  total_volume: number;
}

export interface DailyMarketResponse {
  trade_date: string | null;
  latest_date: string | null;
  available_dates: string[];
  summary: DailyMarketSummary;
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: DailyMarketItem[];
}

export interface BhavcopyImportResult {
  status: 'success' | 'failed' | 'skipped';
  trade_date: string;
  file_name: string;
  source_url: string | null;
  source_format: string | null;
  records_downloaded: number;
  records_parsed: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  records_rejected: number;
  execution_time_seconds: number;
  message: string;
  error_details: string | null;
}

export interface LatestAvailableDateInfo {
  latest_trade_date: string;
  is_trading_day: boolean;
  source_format: string;
  expected_filename: string;
  latest_db_date: string | null;
}

export interface IngestedFileItem {
  id: number;
  job_id: string;
  trade_date: string;
  file_name: string;
  file_path: string | null;
  source_url: string | null;
  file_size: number | null;
  source_format: string;
  parser_version: string;
  status: string;
  row_count: number;
  parsed_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  rejected_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}



