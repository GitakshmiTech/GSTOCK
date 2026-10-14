import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CandlestickChart,
  X,
  Lock,
  MoreVertical,
  BarChart2,
  Copy,
  Check,
  LayoutList,
  Table as TableIcon,
} from 'lucide-react';
import { DailyMarketResponse, DailyMarketItem } from '../types';
import { fetchDailyMarketOHLC } from '../services/api';
import { LoadingState } from '../components/common/LoadingState';

// Helper to format clean company name (e.g. "PB Fintech", "Tata Elxsi")
const cleanCompanyName = (companyName?: string, symbol?: string): string => {
  if (!companyName || companyName.trim() === '') {
    return symbol || '';
  }
  if (companyName.trim().toUpperCase() === symbol?.trim().toUpperCase()) {
    return symbol || '';
  }
  // Strip trailing company suffixes for clean modern terminal display
  const clean = companyName
    .replace(/\s+(Limited|Ltd\.?|LTD|LLP|CORP|CORPORATION)\b/gi, '')
    .replace(/\s+-\s+EQ\b/gi, '')
    .trim();
  return clean || symbol || '';
};

// High-fidelity SVG Sparkline matching terminal Screener layout
interface SparklineProps {
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  symbol: string;
  width?: number;
  height?: number;
}

const IntradaySparkline: React.FC<SparklineProps> = ({
  open,
  high,
  low,
  close,
  prevClose,
  symbol,
  width = 85,
  height = 32,
}) => {
  const isPositive = close >= prevClose;
  const strokeColor = isPositive ? '#16a34a' : '#dc2626';

  const minVal = Math.min(low, prevClose, open, close);
  const maxVal = Math.max(high, prevClose, open, close);
  const span = maxVal > minVal ? maxVal - minVal : 1;

  const padY = 3;
  const padX = 2;
  const usableH = height - 2 * padY;
  const usableW = width - 2 * padX;

  const getY = (price: number) => {
    const fraction = (price - minVal) / span;
    return padY + (1 - fraction) * usableH;
  };

  const getX = (idx: number, total: number) => {
    return padX + (idx / (total - 1)) * usableW;
  };

  const baselineY = getY(prevClose);

  // Deterministic seed from symbol string for subtle organic variation
  const seed = symbol.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
  const pseudoRand = (i: number) => {
    const x = Math.sin(seed + i * 997) * 10000;
    return x - Math.floor(x);
  };

  const numPoints = 12;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    let price: number;

    if (i === 0) {
      price = open;
    } else if (i === numPoints - 1) {
      price = close;
    } else if (isPositive) {
      if (t < 0.25) {
        const w = t / 0.25;
        price = open * (1 - w) + low * w;
      } else if (t < 0.75) {
        const w = (t - 0.25) / 0.5;
        price = low * (1 - w) + high * w;
      } else {
        const w = (t - 0.75) / 0.25;
        price = high * (1 - w) + close * w;
      }
    } else {
      if (t < 0.25) {
        const w = t / 0.25;
        price = open * (1 - w) + high * w;
      } else if (t < 0.75) {
        const w = (t - 0.25) / 0.5;
        price = high * (1 - w) + low * w;
      } else {
        const w = (t - 0.75) / 0.25;
        price = low * (1 - w) + close * w;
      }
    }

    if (i > 0 && i < numPoints - 1) {
      const jitter = (pseudoRand(i) - 0.5) * 0.12 * span;
      price = Math.max(low, Math.min(high, price + jitter));
    }

    points.push({
      x: getX(i, numPoints),
      y: getY(price),
    });
  }

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${width}px`,
        height: `${height}px`,
        flexShrink: 0,
      }}
      title={`Prev: ₹${prevClose.toFixed(2)} | Open: ₹${open.toFixed(2)} | High: ₹${high.toFixed(2)} | Low: ₹${low.toFixed(2)} | Close: ₹${close.toFixed(2)}`}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <line
          x1={0}
          y1={baselineY}
          x2={width}
          y2={baselineY}
          stroke="#cbd5e1"
          strokeDasharray="2 2"
          strokeWidth="1"
          style={{ opacity: 0.8 }}
        />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

interface DailyOHLCProps {
  onNavigate?: (route: string) => void;
}

export const DailyOHLC: React.FC<DailyOHLCProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DailyMarketResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Query Parameters
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [series, setSeries] = useState<string>('EQ');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('turnover');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);

  // Modern Terminal View vs Classic Dense Table View
  const [viewMode, setViewMode] = useState<'terminal' | 'table'>('terminal');
  const [activeMenuSymbol, setActiveMenuSymbol] = useState<string | null>(null);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  // Close floating action menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuSymbol(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Debounce search query to prevent rapid API requests
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1); // Reset to page 1 on new search
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch daily market prices
  const loadMarketData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDailyMarketOHLC({
        trade_date: selectedDate || undefined,
        series: series || undefined,
        search: debouncedSearch || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        filter_type: filterType,
        limit: pageSize,
        page: page,
      });
      setData(res);
      if (!selectedDate && res.trade_date) {
        setSelectedDate(res.trade_date);
      }
    } catch (err: any) {
      console.error('Error loading daily market OHLC:', err);
      setError(err.message || 'Failed to fetch daily market data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, series, debouncedSearch, sortBy, sortOrder, filterType, pageSize, page]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  // Column sort toggle
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Quick navigation helper to jump to other screens with selected symbol
  const handleJumpToStock = (symbol: string, targetScreen: 'explorer' | 'seasonality' | 'comparison' = 'explorer') => {
    const cleanSym = symbol.trim().toUpperCase() === 'ICICI' ? 'ICICIBANK' : symbol.trim().toUpperCase();
    sessionStorage.setItem('selected_stock_symbol', cleanSym);
    if (onNavigate) {
      onNavigate(targetScreen);
    }
  };

  // CSV Exporter for current filtered set
  const exportToCSV = () => {
    if (!data || !data.items || data.items.length === 0) return;

    const headers = [
      'Trade Date',
      'Symbol',
      'Company Name',
      'Series',
      'Open (INR)',
      'High (INR)',
      'Low (INR)',
      'Close (INR)',
      'Prev Close (INR)',
      'Net Change (INR)',
      'Change %',
      'Traded Quantity',
      'Turnover (INR)',
      'Turnover (Cr INR)',
    ];

    const rows = data.items.map((row) => [
      row.trade_date,
      `"${row.symbol}"`,
      `"${(row.company_name || row.symbol).replace(/"/g, '""')}"`,
      row.series,

      row.open_price ?? '',
      row.high_price ?? '',
      row.low_price ?? '',
      row.close_price ?? '',
      row.prev_close ?? '',
      row.change ?? '',
      row.change_pct ?? '',
      row.traded_quantity ?? '',
      row.turnover ?? '',
      row.turnover_cr ?? '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NSE_Daily_Market_OHLC_${data.trade_date || 'latest'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = data?.summary;
  const items = data?.items || [];
  const totalCount = data?.total_count || 0;
  const totalPages = data?.total_pages || 1;
  const availableDates = data?.available_dates || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '20px',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <CandlestickChart size={20} />
              </div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
                All Stocks Daily OHLC
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'var(--nav-active-bg)',
                  color: 'var(--accent)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                LIVE MARKET TERMINAL
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Full day Open, High, Low, Close prices, intraday spreads, turnover, and net gain/loss across all NSE stocks.
            </p>
          </div>

          {/* Action Buttons: Refresh & CSV Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={loadMarketData}
              disabled={loading}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
              title="Refresh Market Data"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportToCSV}
              disabled={!items.length}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                cursor: items.length ? 'pointer' : 'not-allowed',
                opacity: items.length ? 1 : 0.6,
              }}
              title="Export visible records to CSV file"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Date Selection Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Trading Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '6px 10px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono',
                outline: 'none',
              }}
            />
          </div>

          {/* Fast Quick-Switch Date Pills */}
          {availableDates.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginRight: '4px' }}>Quick Dates:</span>
              {availableDates.slice(0, 6).map((dStr, idx) => {
                const isActive = selectedDate === dStr;
                return (
                  <button
                    key={dStr}
                    onClick={() => {
                      setSelectedDate(dStr);
                      setPage(1);
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono',
                      fontWeight: isActive ? 600 : 500,
                      backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-card)',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {idx === 0 ? `Latest (${dStr})` : dStr}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Market Breadth Summary Metrics */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Total Stocks */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px 16px',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Stocks Traded
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'JetBrains Mono' }}>
              {summary.total_stocks.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              On {data?.trade_date || selectedDate}
            </div>
          </div>

          {/* Advances */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px 16px',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase' }}>
                Advances (Gainers)
              </span>
              <TrendingUp size={15} color="var(--green)" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--green)', fontFamily: 'JetBrains Mono' }}>
              {summary.advances.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              {summary.total_stocks > 0 ? `${((summary.advances / summary.total_stocks) * 100).toFixed(1)}% of market` : '-'}
            </div>
          </div>

          {/* Declines */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px 16px',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase' }}>
                Declines (Losers)
              </span>
              <TrendingDown size={15} color="var(--red)" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--red)', fontFamily: 'JetBrains Mono' }}>
              {summary.declines.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              {summary.total_stocks > 0 ? `${((summary.declines / summary.total_stocks) * 100).toFixed(1)}% of market` : '-'}
            </div>
          </div>

          {/* Unchanged */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px 16px',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Unchanged
              </span>
              <Minus size={15} color="var(--text-muted)" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'JetBrains Mono' }}>
              {summary.unchanged.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Zero net change
            </div>
          </div>

          {/* Total Turnover */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px 16px',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Total Turnover
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'JetBrains Mono' }}>
              ₹{summary.total_turnover_cr.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Vol: {(summary.total_volume / 10000000).toFixed(1)} Cr shares
            </div>
          </div>
        </div>
      )}

      {/* Filter, Search & Options Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '14px 16px',
          boxShadow: 'var(--card-shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
              }}
            />
            <input
              type="text"
              placeholder="Search symbol or company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 30px 8px 32px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Series Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Series:</span>
            {[
              { id: 'EQ', label: 'EQ (Mainboard)' },
              { id: 'SM', label: 'SM (SME)' },
              { id: 'ST', label: 'ST (SME T2T)' },
              { id: 'BE', label: 'BE (T2T)' },
              { id: 'ALL', label: 'All Equities' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSeries(s.id);
                  setPage(1);
                }}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: series === s.id ? 600 : 500,
                  backgroundColor: series === s.id ? 'var(--nav-active-bg)' : 'var(--bg-card)',
                  color: series === s.id ? 'var(--accent)' : 'var(--text-muted)',
                  border: `1px solid ${series === s.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Page Size Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: '6px 10px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--text-main)',
                fontFamily: 'JetBrains Mono',
                outline: 'none',
              }}
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={500}>500 rows</option>
            </select>
          </div>
        </div>

        {/* Performance Filter Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            paddingTop: '10px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Performance Filter:</span>
          {[
            { id: 'ALL', label: 'All Returns' },
            { id: 'GAINERS', label: 'Gainers (> 0%)', color: 'var(--green)' },
            { id: 'LOSERS', label: 'Losers (< 0%)', color: 'var(--red)' },
            { id: 'BIG_GAINERS', label: 'Big Gainers (≥ +5%)', color: 'var(--green)' },
            { id: 'BIG_LOSERS', label: 'Big Losers (≤ -5%)', color: 'var(--red)' },
            { id: 'UNCHANGED', label: 'Unchanged (0.00%)' },
          ].map((f) => {
            const isActive = filterType === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  setFilterType(f.id);
                  setPage(1);
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 500,
                  backgroundColor: isActive ? 'var(--nav-active-bg)' : 'var(--bg-card)',
                  color: isActive ? (f.color || 'var(--accent)') : 'var(--text-muted)',
                  border: `1px solid ${isActive ? (f.color || 'var(--accent)') : 'var(--border)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main OHLC Table Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Table Controls Top Info */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--table-th-bg)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              Showing <strong style={{ color: 'var(--text-main)' }}>{items.length}</strong> of{' '}
              <strong style={{ color: 'var(--text-main)' }}>{totalCount.toLocaleString()}</strong> matching stocks
              {debouncedSearch ? ` for "${debouncedSearch}"` : ''}
            </div>

            {/* View Layout Switcher */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <button
                onClick={() => setViewMode('terminal')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 9px',
                  fontSize: '11px',
                  fontWeight: viewMode === 'terminal' ? 600 : 500,
                  backgroundColor: viewMode === 'terminal' ? 'var(--accent)' : 'transparent',
                  color: viewMode === 'terminal' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Modern Financial Screener View (Stacked Price & Sparklines)"
              >
                <LayoutList size={13} />
                <span>Modern View</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 9px',
                  fontSize: '11px',
                  fontWeight: viewMode === 'table' ? 600 : 500,
                  backgroundColor: viewMode === 'table' ? 'var(--accent)' : 'transparent',
                  color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Classic Dense Data Table"
              >
                <TableIcon size={13} />
                <span>Classic Table</span>
              </button>
            </div>
          </div>

          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }}>
            Sorted by: <strong style={{ color: 'var(--text-main)' }}>{sortBy}</strong> ({sortOrder.toUpperCase()})
          </div>
        </div>

        {/* Loading / Error / Table Content */}
        {loading ? (
          <div style={{ padding: '60px 20px' }}>
            <LoadingState message="Querying all stock OHLC prices from database..." />
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--red)' }}>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Failed to load daily market data</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>{error}</p>
            <button onClick={loadMarketData} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
              No stock quotes found
            </p>
            <p style={{ fontSize: '12px', maxWidth: '400px', margin: '0 auto 16px auto' }}>
              No market price records matched your search or filters for the date{' '}
              <strong style={{ color: 'var(--text-main)' }}>{selectedDate}</strong>.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('ALL');
                setSeries('EQ');
              }}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'terminal' ? (
          /* ========================================================================= */
          /* MODERN FINANCIAL SCREENER VIEW (MATCHES USER SCREENSHOT)                  */
          /* ========================================================================= */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border)' }}>
                  {/* Stock Column */}
                  <th
                    onClick={() => handleSort('symbol')}
                    style={{
                      padding: '12px 16px',
                      color: sortBy === 'symbol' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: '220px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Stock</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Trend / Sparkline Column */}
                  <th
                    style={{
                      padding: '12px 12px',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'center',
                      width: '100px',
                      userSelect: 'none',
                    }}
                  >
                    Trend
                  </th>

                  {/* Price / Change Column */}
                  <th
                    onClick={() => handleSort('close_price')}
                    style={{
                      padding: '12px 16px',
                      color: sortBy === 'close_price' || sortBy === 'change_pct' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: '130px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Price / Change</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Day High */}
                  <th
                    onClick={() => handleSort('high_price')}
                    style={{
                      padding: '12px 16px',
                      color: sortBy === 'high_price' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: '95px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>High (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Day Low */}
                  <th
                    onClick={() => handleSort('low_price')}
                    style={{
                      padding: '12px 16px',
                      color: sortBy === 'low_price' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: '95px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Low (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Traded Volume (K) */}
                  <th
                    onClick={() => handleSort('traded_quantity')}
                    style={{
                      padding: '12px 16px',
                      color: sortBy === 'traded_quantity' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: '95px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Volume (K)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Open Price */}
                  <th
                    onClick={() => handleSort('open_price')}
                    style={{
                      padding: '12px 16px',
                      color: sortBy === 'open_price' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: '95px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Open (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Actions Column */}
                  <th
                    style={{
                      padding: '12px 16px',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      width: '140px',
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const isPositive = row.change > 0;
                  const isNegative = row.change < 0;

                  // High-volume or volatility signal badges (Strike Screener style)
                  const isVolShocker = row.turnover_cr >= 20 || row.traded_quantity >= 300000;
                  const isBigMover = Math.abs(row.change_pct) >= 3.5;
                  const displayName = cleanCompanyName(row.company_name, row.symbol);

                  return (
                    <tr
                      key={`${row.symbol}-${row.series}`}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-surface)',
                        transition: 'background-color 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                    >
                      {/* 1. Stock / Company Column */}
                      <td style={{ padding: '15px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              onClick={() => handleJumpToStock(row.symbol, 'explorer')}
                              style={{
                                fontSize: '15px',
                                fontWeight: 700,
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                letterSpacing: '-0.2px',
                                textDecoration: 'none',
                              }}
                              title={`Click to analyze ${row.symbol} in Stock Explorer`}
                            >
                              {displayName}
                            </span>
                            {displayName.toUpperCase() !== row.symbol.toUpperCase() && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'JetBrains Mono',
                                  color: 'var(--text-dim)',
                                  fontWeight: 500,
                                }}
                              >
                                {row.symbol}
                              </span>
                            )}
                          </div>

                          {/* Pills / Badges underneath company name (Vol Shocker, +1, EQ, etc.) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {isVolShocker && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: '#e6f9ed',
                                  color: '#16a34a',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: '12px',
                                  padding: '2px 8px',
                                  lineHeight: '14px',
                                }}
                              >
                                Vol Shocker
                              </span>
                            )}
                            {isBigMover && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  backgroundColor: isPositive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                                  color: isPositive ? 'var(--green)' : 'var(--red)',
                                  border: `1px solid ${isPositive ? '#bbf7d0' : '#fecaca'}`,
                                  borderRadius: '12px',
                                  padding: '1px 7px',
                                  lineHeight: '14px',
                                }}
                              >
                                {isPositive ? 'Breakout' : 'High Dip'}
                              </span>
                            )}
                            {isVolShocker && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '12px',
                                  padding: '1px 7px',
                                  lineHeight: '14px',
                                }}
                              >
                                +1
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Sparkline / Intraday Path */}
                      <td style={{ padding: '15px 12px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <IntradaySparkline
                          open={row.open_price ?? row.close_price}
                          high={row.high_price ?? Math.max(row.open_price, row.close_price)}
                          low={row.low_price ?? Math.min(row.open_price, row.close_price)}
                          close={row.close_price}
                          prevClose={row.prev_close ?? row.open_price}
                          symbol={row.symbol}
                          width={85}
                          height={32}
                        />
                      </td>

                      {/* 3. Stacked Close Price & Change */}
                      <td style={{ padding: '15px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono',
                              fontWeight: 700,
                              fontSize: '15px',
                              color: 'var(--text-main)',
                              letterSpacing: '-0.2px',
                            }}
                          >
                            {row.close_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono',
                              fontWeight: 600,
                              fontSize: '12px',
                              color: isPositive ? 'var(--green)' : isNegative ? 'var(--red)' : 'var(--text-muted)',
                              lineHeight: '14px',
                            }}
                          >
                            {row.change >= 0 ? `${row.change.toFixed(2)}` : row.change.toFixed(2)}{' '}
                            ({row.change_pct >= 0 ? `${row.change_pct.toFixed(2)}%` : `${row.change_pct.toFixed(2)}%`})
                          </span>
                        </div>
                      </td>

                      {/* 4. High (₹) */}
                      <td
                        style={{
                          padding: '15px 16px',
                          verticalAlign: 'middle',
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '13px',
                          color: 'var(--text-main)',
                          fontWeight: 500,
                        }}
                      >
                        {row.high_price != null
                          ? row.high_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </td>

                      {/* 5. Low (₹) */}
                      <td
                        style={{
                          padding: '15px 16px',
                          verticalAlign: 'middle',
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '13px',
                          color: 'var(--text-main)',
                          fontWeight: 500,
                        }}
                      >
                        {row.low_price != null
                          ? row.low_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </td>

                      {/* 6. Volume (K) */}
                      <td
                        style={{
                          padding: '15px 16px',
                          verticalAlign: 'middle',
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '13px',
                          color: 'var(--text-main)',
                          fontWeight: 500,
                        }}
                        title={`${row.traded_quantity.toLocaleString('en-IN')} shares traded (₹${row.turnover_cr.toFixed(2)} Cr)`}
                      >
                        {(row.traded_quantity / 1000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 7. Open (₹) */}
                      <td
                        style={{
                          padding: '15px 16px',
                          verticalAlign: 'middle',
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '13px',
                          color: 'var(--text-main)',
                          fontWeight: 500,
                        }}
                      >
                        {row.open_price != null
                          ? row.open_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </td>

                      {/* 8. Analysis Pill Button + More Menu */}
                      <td style={{ padding: '15px 16px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleJumpToStock(row.symbol, 'explorer')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '9999px',
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--accent)';
                              e.currentTarget.style.backgroundColor = 'var(--nav-active-bg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                            }}
                            title={`Open in-depth technical analysis for ${row.symbol}`}
                          >
                            <Lock size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
                            <span>Analysis</span>
                          </button>

                          {/* Dropdown Menu Trigger */}
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuSymbol(activeMenuSymbol === row.symbol ? null : row.symbol);
                              }}
                              style={{
                                background: 'none',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                padding: '4px',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="More actions"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {/* Floating Action Menu */}
                            {activeMenuSymbol === row.symbol && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  marginTop: '4px',
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                  zIndex: 50,
                                  minWidth: '190px',
                                  padding: '4px 0',
                                  textAlign: 'left',
                                }}
                              >
                                <button
                                  onClick={() => {
                                    setActiveMenuSymbol(null);
                                    handleJumpToStock(row.symbol, 'explorer');
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    color: 'var(--text-main)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <BarChart2 size={13} color="var(--accent)" />
                                  <span>Stock Explorer</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveMenuSymbol(null);
                                    handleJumpToStock(row.symbol, 'seasonality');
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    color: 'var(--text-main)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <Calendar size={13} color="var(--gold)" />
                                  <span>Seasonality Cycles</span>
                                </button>

                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(row.symbol);
                                    setCopiedSymbol(row.symbol);
                                    setTimeout(() => setCopiedSymbol(null), 2000);
                                    setActiveMenuSymbol(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    color: 'var(--text-main)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  {copiedSymbol === row.symbol ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
                                  <span>{copiedSymbol === row.symbol ? 'Copied Symbol!' : 'Copy Symbol'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ========================================================================= */
          /* CLASSIC DENSE TABLE VIEW                                                  */
          /* ========================================================================= */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, width: '40px' }}>#</th>

                  {/* Symbol & Company */}
                  <th
                    onClick={() => handleSort('symbol')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'symbol' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Symbol & Company</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  <th style={{ padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', width: '55px' }}>
                    Series
                  </th>

                  {/* Open Price */}
                  <th
                    onClick={() => handleSort('open_price')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'open_price' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Open (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Day High */}
                  <th
                    onClick={() => handleSort('high_price')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'high_price' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Day High (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Day Low */}
                  <th
                    onClick={() => handleSort('low_price')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'low_price' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Day Low (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Day Close */}
                  <th
                    onClick={() => handleSort('close_price')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'close_price' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Day Close (₹)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Prev Close */}
                  <th
                    onClick={() => handleSort('prev_close')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'prev_close' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Prev Close</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Net Change % */}
                  <th
                    onClick={() => handleSort('change_pct')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'change_pct' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Change (%)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Day Range Mini-Bar */}
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', width: '130px' }}>
                    Day Range (L — H)
                  </th>

                  {/* Traded Volume */}
                  <th
                    onClick={() => handleSort('traded_quantity')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'traded_quantity' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Volume</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Turnover (Cr) */}
                  <th
                    onClick={() => handleSort('turnover')}
                    style={{
                      padding: '10px 12px',
                      color: sortBy === 'turnover' ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Turnover (₹ Cr)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const rowIndex = (page - 1) * pageSize + idx + 1;
                  const isPositive = row.change > 0;
                  const isNegative = row.change < 0;

                  const high = row.high_price ?? row.close_price;
                  const low = row.low_price ?? row.close_price;
                  const close = row.close_price;
                  let rangePct = 50;
                  if (high > low) {
                    rangePct = Math.max(0, Math.min(100, ((close - low) / (high - low)) * 100));
                  }

                  return (
                    <tr
                      key={`${row.symbol}-${row.series}`}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Row # */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', fontSize: '11px' }}>
                        {rowIndex}
                      </td>

                      {/* Symbol & Company Name */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            onClick={() => handleJumpToStock(row.symbol, 'explorer')}
                            style={{
                              fontFamily: 'JetBrains Mono',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Click to view charts in Stock Explorer"
                          >
                            {row.symbol}
                          </span>
                          {row.company_name && row.company_name.trim().toUpperCase() !== row.symbol.trim().toUpperCase() && (
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '220px',
                              }}
                              title={row.company_name}
                            >
                              {row.company_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Series Badge */}
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: row.series === 'EQ' ? 'var(--nav-active-bg)' : 'var(--tile-summary-bg)',
                            color: row.series === 'EQ' ? 'var(--accent)' : 'var(--text-muted)',
                            fontFamily: 'JetBrains Mono',
                          }}
                        >
                          {row.series}
                        </span>
                      </td>

                      {/* Open Price */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>
                        {row.open_price != null ? row.open_price.toFixed(2) : '-'}
                      </td>

                      {/* Day High */}
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono',
                          color: isPositive ? 'var(--green)' : 'var(--text-main)',
                          fontWeight: 500,
                        }}
                      >
                        {row.high_price != null ? row.high_price.toFixed(2) : '-'}
                      </td>

                      {/* Day Low */}
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono',
                          color: isNegative ? 'var(--red)' : 'var(--text-main)',
                          fontWeight: 500,
                        }}
                      >
                        {row.low_price != null ? row.low_price.toFixed(2) : '-'}
                      </td>

                      {/* Day Close */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--text-main)' }}>
                        {row.close_price.toFixed(2)}
                      </td>

                      {/* Prev Close */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', fontSize: '11px' }}>
                        {row.prev_close.toFixed(2)}
                      </td>

                      {/* Net Change % Badge */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'JetBrains Mono',
                            backgroundColor: isPositive ? 'var(--tile-pos-bg)' : isNegative ? 'var(--tile-neg-bg)' : 'var(--tile-summary-bg)',
                            color: isPositive ? 'var(--tile-pos-color)' : isNegative ? 'var(--tile-neg-color)' : 'var(--text-muted)',
                            border: `1px solid ${isPositive ? 'var(--tile-pos-border)' : isNegative ? 'var(--tile-neg-border)' : 'var(--border)'}`,
                          }}
                        >
                          {isPositive ? <ArrowUp size={10} /> : isNegative ? <ArrowDown size={10} /> : null}
                          {row.change >= 0 ? `+${row.change.toFixed(2)}` : row.change.toFixed(2)} (
                          {row.change_pct >= 0 ? `+${row.change_pct.toFixed(2)}%` : `${row.change_pct.toFixed(2)}%`})
                        </span>
                      </td>

                      {/* Day Range Mini-Bar */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                          <div
                            style={{
                              position: 'relative',
                              width: '100px',
                              height: '5px',
                              backgroundColor: 'var(--border)',
                              borderRadius: '3px',
                              overflow: 'visible',
                            }}
                            title={`Low: ${low.toFixed(2)} | Close: ${close.toFixed(2)} | High: ${high.toFixed(2)}`}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                left: `${rangePct}%`,
                                top: '-3px',
                                width: '4px',
                                height: '11px',
                                backgroundColor: isPositive ? 'var(--green)' : isNegative ? 'var(--red)' : 'var(--accent)',
                                borderRadius: '2px',
                                transform: 'translateX(-50%)',
                              }}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              width: '100px',
                              fontSize: '9px',
                              color: 'var(--text-dim)',
                              fontFamily: 'JetBrains Mono',
                            }}
                          >
                            <span>{low.toFixed(0)}</span>
                            <span>{high.toFixed(0)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Traded Volume */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>
                        {row.traded_quantity.toLocaleString('en-IN')}
                      </td>

                      {/* Turnover (Cr) */}
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                        }}
                      >
                        ₹{row.turnover_cr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: 'var(--table-th-bg)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Page <strong style={{ color: 'var(--text-main)' }}>{page}</strong> of{' '}
              <strong style={{ color: 'var(--text-main)' }}>{totalPages}</strong> ({totalCount.toLocaleString()} stocks)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="btn-secondary"
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  cursor: page > 1 ? 'pointer' : 'not-allowed',
                  opacity: page > 1 ? 1 : 0.5,
                }}
                title="First Page"
              >
                <ChevronsLeft size={14} />
              </button>

              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="btn-secondary"
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  cursor: page > 1 ? 'pointer' : 'not-allowed',
                  opacity: page > 1 ? 1 : 0.5,
                }}
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Jump to Page Number Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (totalPages > 5) {
                    if (page <= 3) {
                      pNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pNum = totalPages - 4 + i;
                    } else {
                      pNum = page - 2 + i;
                    }
                  }
                  const isCurrent = pNum === page;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      style={{
                        padding: '4px 9px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                        fontWeight: isCurrent ? 700 : 500,
                        backgroundColor: isCurrent ? 'var(--accent)' : 'var(--bg-card)',
                        color: isCurrent ? '#ffffff' : 'var(--text-main)',
                        border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="btn-secondary"
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  cursor: page < totalPages ? 'pointer' : 'not-allowed',
                  opacity: page < totalPages ? 1 : 0.5,
                }}
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="btn-secondary"
                style={{
                  padding: '5px 8px',
                  fontSize: '12px',
                  cursor: page < totalPages ? 'pointer' : 'not-allowed',
                  opacity: page < totalPages ? 1 : 0.5,
                }}
                title="Last Page"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
