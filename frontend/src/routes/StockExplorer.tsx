import React, { useEffect, useState } from 'react';
import { StockExplorerData, SecurityMasterItem } from '../types';
import { fetchStockPrices, fetchSecurities } from '../services/api';
import { PriceChart } from '../components/charts/PriceChart';
import { VolumeChart } from '../components/charts/VolumeChart';
import { MetricCard } from '../components/dashboard/MetricCard';
import { LoadingState } from '../components/common/LoadingState';

export const StockExplorer: React.FC = () => {
  const [symbol, setSymbol] = useState(() => {
    const stored = sessionStorage.getItem('selected_stock_symbol');
    return stored === 'ICICI' ? 'ICICIBANK' : (stored || '');
  });
  const [data, setData] = useState<StockExplorerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [securities, setSecurities] = useState<SecurityMasterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load securities catalog for fast selection with company names
  useEffect(() => {
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
      .catch((err) => console.error('Failed to fetch securities:', err));
  }, []);

  const resolveSymbol = (sym: string): string => {
    const clean = sym.trim().toUpperCase();
    if (clean === 'ICICI') return 'ICICIBANK';
    return clean;
  };

  const loadStock = (sym: string) => {
    const cleanSym = resolveSymbol(sym);
    if (!cleanSym) return;
    setSymbol(cleanSym);
    setData(null);
    sessionStorage.setItem('selected_stock_symbol', cleanSym);
    setLoading(true);
    fetchStockPrices(cleanSym)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    const initialSym = sessionStorage.getItem('selected_stock_symbol') || symbol;
    if (initialSym) {
      loadStock(initialSym);
    }
  }, []);

  // Find company name for active symbol
  const activeSec = securities.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
  const companyTitle =
    activeSec?.company_name && activeSec.company_name.trim().toUpperCase() !== symbol.trim().toUpperCase()
      ? `${symbol} — ${activeSec.company_name}`
      : symbol;

  const filteredSecurities = React.useMemo(() => {
    if (!searchQuery.trim()) return securities;
    const q = searchQuery.trim().toUpperCase();
    const matches = securities.filter((s) => {
      return s.symbol.toUpperCase().includes(q) || (s.company_name && s.company_name.toUpperCase().includes(q));
    });
    // Ensure ICICIBANK is prioritized first when searching for ICICI
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

  const handleSearchSubmit = () => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) {
      loadStock(symbol);
      return;
    }
    const target = q === 'ICICI' ? 'ICICIBANK' : (filteredSecurities[0]?.symbol || q);
    loadStock(target);
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Interactive Chart Terminal — {companyTitle}</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Historical 26-Year Candlestick Price Action, Volume & Moving Averages
          </div>
        </div>

        {/* Quick Stock Selector with Company Names */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            className="filter-num-input"
            style={{ minWidth: 280, maxWidth: 360, height: 36 }}
            value={symbol}
            onChange={(e) => loadStock(e.target.value)}
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
            ) : symbol ? (
              <option value={symbol}>{symbol}</option>
            ) : null}
          </select>


          <input
            type="text"
            placeholder="🔍 Search stock..."
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

          <button className="btn-primary" onClick={handleSearchSubmit} style={{ height: 36, padding: '0 16px' }}>
            Load
          </button>
        </div>
      </div>

      {loading && <LoadingState message={`Loading historical data for ${companyTitle}...`} />}

      {!loading && !data && (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            marginTop: '20px',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
            No Stock Selected
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
            Search or select a stock from the dropdown above to view interactive candlestick charts and technical indicators.
          </p>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="metrics-row">
            <MetricCard
              label="Latest Close"
              value={`₹${data.summary.latest_close?.toFixed(2) || '--'}`}
            />
            <MetricCard
              label="Total Return"
              value={`${data.summary.total_return_pct}%`}
              trend={data.summary.total_return_pct >= 0 ? 'up' : 'down'}
            />
            <MetricCard
              label="Annualized Volatility"
              value={`${data.summary.annualized_volatility_pct}%`}
            />
            <MetricCard
              label="Maximum Drawdown"
              value={`${data.summary.max_drawdown_pct}%`}
              trend="down"
            />
          </div>

          <PriceChart symbol={symbol} data={data.data} />
          <VolumeChart data={data.data} />
        </>
      )}
    </div>
  );
};
