import React, { useEffect, useState, useMemo } from 'react';
import { MarketOverviewData, SecurityMasterItem } from '../types';
import { fetchMarketOverview, fetchSecurities } from '../services/api';
import { MarketOverview } from '../components/dashboard/MarketOverview';
import { MarketMovers } from '../components/dashboard/MarketMovers';
import { MarketCharts } from '../components/dashboard/MarketCharts';
import { LoadingState } from '../components/common/LoadingState';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardProps {
  onNavigate?: (route: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<MarketOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Securities catalog for stock search and dropdown
  const [securities, setSecurities] = useState<SecurityMasterItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<string>(() => {
    return sessionStorage.getItem('selected_stock_symbol') || '';
  });
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    fetchMarketOverview()
      .then((res) => {
        setData(res);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadData();

    // Fetch securities catalog for quick selection with company names
    fetchSecurities('', 5000)
      .then((res) => {
        if (res && res.length > 0) {
          const seen = new Set<string>();
          const deduped: SecurityMasterItem[] = [];
          for (const s of res) {
            const sym = s.symbol.trim().toUpperCase();
            if (!seen.has(sym)) {
              seen.add(sym);
              deduped.push(s);
            }
          }
          setSecurities(deduped);
        }
      })
      .catch((err) => console.error('Failed to fetch securities catalog in Dashboard:', err));
  }, []);

  // Filtered securities for search query matching symbol or company name
  const filteredSecurities = useMemo(() => {
    if (!searchQuery.trim()) return securities;
    const q = searchQuery.trim().toUpperCase();
    const matches = securities.filter((s) => {
      return s.symbol.toUpperCase().includes(q) || (s.company_name && s.company_name.toUpperCase().includes(q));
    });
    return matches.sort((a, b) => {
      const aSym = a.symbol.toUpperCase();
      const bSym = b.symbol.toUpperCase();
      if (q === 'ICICI') {
        if (aSym === 'ICICIBANK') return -1;
        if (bSym === 'ICICIBANK') return 1;
      }
      if (aSym === q) return -1;
      if (bSym === q) return 1;
      return 0;
    });
  }, [securities, searchQuery]);

  // Load stock and navigate to Stock Explorer
  const handleLoadStock = (stockToLoad?: string) => {
    const raw = stockToLoad || selectedStock || (filteredSecurities[0]?.symbol) || searchQuery.trim().toUpperCase();
    if (!raw) return;
    const clean = raw.includes('—') ? raw.split('—')[0].trim().toUpperCase() : raw.trim().toUpperCase();
    const resolved = clean === 'ICICI' ? 'ICICIBANK' : clean;
    if (!resolved) return;
    setSelectedStock(resolved);
    sessionStorage.setItem('selected_stock_symbol', resolved);
    if (onNavigate) {
      onNavigate('explorer');
    }
  };

  const handleSearchSubmit = () => {
    handleLoadStock();
  };

  const handleSelectStock = (symbol: string) => {
    setSelectedStock(symbol);
    sessionStorage.setItem('selected_stock_symbol', symbol);
    if (onNavigate) {
      onNavigate('explorer');
    }
  };

  if (loading) return <LoadingState message="Fetching market overview & top movers..." />;
  if (!data) return <div style={{ color: 'var(--red)', padding: '20px' }}>Failed to load market data.</div>;

  const isBullish = data.advances >= data.declines;

  return (
    <div>
      {/* Top Header / Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: 'var(--bg-surface)',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              NSE Market Intelligence Dashboard
            </h2>
            {data.latest_date && (
              <span style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '12px',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {data.latest_date}
              </span>
            )}
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: isBullish ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: isBullish ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${isBullish ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
            }}>
              {isBullish ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isBullish ? 'BULLISH BREADTH' : 'BEARISH BREADTH'}
            </span>
          </div>

          {data.latest_job && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Bhavcopy Sync: <b style={{ color: data.latest_job.status === 'SUCCESS' ? 'var(--green)' : 'var(--red)' }}>{data.latest_job.status}</b> ({data.latest_job.job_type}) • {data.latest_job.total_rows.toLocaleString()} records ingested • {data.latest_job.completed_at ? data.latest_job.completed_at.substring(0, 19).replace('T', ' ') : 'Ready'}
            </div>
          )}
        </div>

        {/* Quick Stock Selector: Dropdown + Search + Load + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Stock Dropdown */}
          <select
            className="filter-num-input"
            style={{ minWidth: 260, maxWidth: 360, height: 36 }}
            value={selectedStock}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedStock(val);
              if (val) {
                handleLoadStock(val);
              }
            }}
          >
            <option value="">Select a stock...</option>
            {filteredSecurities.length > 0 ? (
              filteredSecurities.slice(0, 500).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.company_name && s.company_name.trim().toUpperCase() !== s.symbol.trim().toUpperCase()
                    ? `${s.symbol} — ${s.company_name}`
                    : s.symbol}
                </option>
              ))
            ) : selectedStock ? (
              <option value={selectedStock}>{selectedStock}</option>
            ) : null}
          </select>

          {/* Search Input */}
          <input
            type="text"
            placeholder="🔍 Search stock.."
            className="filter-num-input"
            style={{ width: 140, height: 36 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearchSubmit();
              }
            }}
          />

          {/* Load Button */}
          <button
            className="btn-primary"
            onClick={handleSearchSubmit}
            style={{ height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Load
          </button>

          {/* Refresh Data Button */}
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              height: 36,
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Refresh market statistics"
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <MarketOverview data={data} />

      {/* Database Empty Banner (if applicable) */}
      {(!data.latest_date || (data.total_records_count || 0) === 0) && (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          marginTop: '20px',
          marginBottom: '20px',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            No Stock Price History in Database
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 16px auto' }}>
            The database is initialized and ready. Use the Automatic Bhavcopy Ingestion tool to download and import official CM-UDiFF / Legacy reports directly from NSE India.
          </p>
          <button
            onClick={() => onNavigate?.('data-mgmt')}
            className="btn-primary"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Go to Bhavcopy Importer
          </button>
        </div>
      )}

      {/* Interactive Charts Section */}
      <MarketCharts
        gainers={data.top_gainers}
        losers={data.top_losers}
        mostActive={data.most_active}
        advances={data.advances}
        declines={data.declines}
        unchanged={data.unchanged}
        onSelectStock={handleSelectStock}
      />

      {/* Top 5 Gainers (with Up sign) and Top 5 Losers (with Down sign) */}
      <MarketMovers
        gainers={data.top_gainers}
        losers={data.top_losers}
        mostActive={data.most_active}
        onSelectStock={handleSelectStock}
      />
    </div>
  );
};
