import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ComparisonData, SecurityMasterItem } from '../types';
import { fetchStockComparison, fetchSecurities } from '../services/api';
import { isShare, resolveCanonicalSymbol, isDelisted, getDelistedNotice } from '../utils/securityUtils';
import { LoadingState } from '../components/common/LoadingState';
import { useTheme } from '../context/ThemeContext';

declare const Plotly: any;

type DatePresetType = 'all' | '1y' | '2y' | '3y' | 'custom';

const CHART_PALETTE = [
  '#2563eb', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#14b8a6', // Teal
];

const QUICK_BASKETS = [
  { label: 'Bluechips', symbols: ['RELIANCE', 'SBIN', 'TISCO'] },
  { label: 'Banking', symbols: ['SBIN', 'HDFCBANK', 'ICICIBANK'] },
  { label: 'IT Giants', symbols: ['INFOSYSTCH', 'WIPRO', 'SATYAMCOMP'] },
  { label: 'Auto', symbols: ['TATAMOTORS', 'BAJAJAUTO', 'M&M'] },
  { label: 'Pharma', symbols: ['CIPLA', 'RANBAXY', 'DRREDDY'] },
  { label: 'Metals & Energy', symbols: ['TISCO', 'SAIL', 'BHEL', 'GAIL'] },
];

export const MarketComparison: React.FC = () => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(() => {
    const stored = sessionStorage.getItem('selected_stock_symbol');
    if (stored) {
      return [resolveCanonicalSymbol(stored), 'RELIANCE'];
    }
    return ['RELIANCE', 'SBIN'];
  });

  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Securities master catalog for dropdown & search
  const [securities, setSecurities] = useState<SecurityMasterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownValue, setDropdownValue] = useState('');

  // Date Filter State
  const [datePreset, setDatePreset] = useState<DatePresetType>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const chartRef = useRef<HTMLDivElement>(null);
  const { chartTheme } = useTheme();

  // Load securities catalog for fast dropdown selection (Shares only)
  useEffect(() => {
    fetchSecurities('', 5000, true)
      .then((res) => {
        if (res && res.length > 0) {
          const seen = new Set<string>();
          const deduped: SecurityMasterItem[] = [];
          for (const s of res) {
            if (!isShare(s)) continue;
            const sym = s.symbol.trim().toUpperCase();
            if (!seen.has(sym)) {
              seen.add(sym);
              deduped.push(s);
            }
          }
          const sorted = deduped.sort((a, b) => a.symbol.localeCompare(b.symbol));
          setSecurities(sorted);
        }
      })
      .catch((err) => console.error('Failed to load securities in MarketComparison:', err));
  }, []);

  // Filtered list of shares based on search query
  const filteredSecurities = useMemo(() => {
    const baseShares = securities.filter(isShare);
    if (!searchQuery.trim()) return baseShares;
    const q = searchQuery.trim().toUpperCase();
    const matches = baseShares.filter(
      (s) => s.symbol.toUpperCase().includes(q) || (s.company_name && s.company_name.toUpperCase().includes(q))
    );
    return matches.sort((a, b) => {
      const aSym = a.symbol.toUpperCase();
      const bSym = b.symbol.toUpperCase();
      if (q === 'ICICI') {
        if (aSym === 'ICICIBANK') return -1;
        if (bSym === 'ICICIBANK') return 1;
      }
      if (q === '3M' || q === 'BIRLA3M') {
        if (aSym === '3MINDIA') return -1;
        if (bSym === '3MINDIA') return 1;
      }
      if (aSym === q) return -1;
      if (bSym === q) return 1;
      return aSym.localeCompare(bSym);
    });
  }, [securities, searchQuery]);

  const resolveSymbol = (sym: string): string => {
    return resolveCanonicalSymbol(sym);
  };

  const loadComparison = (symbolsList: string[], startD?: string, endD?: string) => {
    const list = symbolsList.map(resolveSymbol).filter(Boolean);
    if (list.length === 0) {
      setData(null);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    fetchStockComparison(list, startD || undefined, endD || undefined)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load comparison:', err);
        setErrorMsg('Failed to calculate comparison metrics. Please check symbol names or date range.');
        setLoading(false);
      });
  };

  // Initial load
  useEffect(() => {
    if (selectedSymbols.length > 0) {
      loadComparison(selectedSymbols, startDate, endDate);
    }
  }, []);

  // Add stock from Dropdown
  const handleSelectFromDropdown = (sym: string) => {
    if (!sym) return;
    const clean = resolveSymbol(sym);
    if (!selectedSymbols.includes(clean)) {
      const updated = [...selectedSymbols, clean];
      setSelectedSymbols(updated);
      loadComparison(updated, startDate, endDate);
    }
    setDropdownValue('');
  };

  // Add stock from Search Bar
  const handleSearchAddStock = () => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return;
    const target = q === 'ICICI' ? 'ICICIBANK' : (filteredSecurities[0]?.symbol || q);
    const clean = resolveSymbol(target);
    if (!selectedSymbols.includes(clean)) {
      const updated = [...selectedSymbols, clean];
      setSelectedSymbols(updated);
      loadComparison(updated, startDate, endDate);
    }
    setSearchQuery('');
  };

  // Remove a stock chip
  const handleRemoveSymbol = (symToRemove: string) => {
    const updated = selectedSymbols.filter((s) => s !== symToRemove);
    setSelectedSymbols(updated);
    if (updated.length > 0) {
      loadComparison(updated, startDate, endDate);
    } else {
      setData(null);
    }
  };

  // Clear all stocks
  const handleClearAll = () => {
    setSelectedSymbols([]);
    setData(null);
  };

  // Quick Basket click
  const handleBasketClick = (symbols: string[]) => {
    setSelectedSymbols(symbols);
    loadComparison(symbols, startDate, endDate);
  };

  // Quick Date Preset handler
  const applyDatePreset = (preset: DatePresetType) => {
    setDatePreset(preset);
    let maxDateStr = '2026-10-13';
    if (data?.series) {
      for (const sym of Object.keys(data.series)) {
        const arr = data.series[sym];
        if (arr && arr.length > 0) {
          const lastDate = arr[arr.length - 1].trade_date;
          if (lastDate > maxDateStr) maxDateStr = lastDate;
        }
      }
    }
    let start = '';
    let end = '';

    if (preset === 'all') {
      start = '';
      end = '';
    } else if (preset === '1y') {
      const d = new Date(maxDateStr);
      d.setFullYear(d.getFullYear() - 1);
      start = d.toISOString().split('T')[0];
      end = maxDateStr;
    } else if (preset === '2y') {
      const d = new Date(maxDateStr);
      d.setFullYear(d.getFullYear() - 2);
      start = d.toISOString().split('T')[0];
      end = maxDateStr;
    } else if (preset === '3y') {
      const d = new Date(maxDateStr);
      d.setFullYear(d.getFullYear() - 3);
      start = d.toISOString().split('T')[0];
      end = maxDateStr;
    }

    setStartDate(start);
    setEndDate(end);
    loadComparison(selectedSymbols, start, end);
  };

  const handleCustomDateSubmit = () => {
    setDatePreset('custom');
    loadComparison(selectedSymbols, startDate, endDate);
  };

  const handleResetDates = () => {
    setStartDate('');
    setEndDate('');
    setDatePreset('all');
    loadComparison(selectedSymbols, '', '');
  };

  // Summary highlights calculations
  const statsHighlights = useMemo(() => {
    if (!data?.summary || data.summary.length === 0) return null;
    const sortedByReturn = [...data.summary].sort((a, b) => b.cumulative_return_pct - a.cumulative_return_pct);
    const sortedByVol = [...data.summary].sort((a, b) => a.annualized_volatility_pct - b.annualized_volatility_pct);
    const sortedByDD = [...data.summary].sort((a, b) => Math.abs(a.max_drawdown_pct) - Math.abs(b.max_drawdown_pct));
    return {
      bestPerformer: sortedByReturn[0],
      lowestVol: sortedByVol[0],
      lowestDD: sortedByDD[0],
    };
  }, [data]);

  // Derived active date range string
  const activeDateSpanText = useMemo(() => {
    if (startDate && endDate) return `${startDate} → ${endDate}`;
    if (startDate) return `Since ${startDate}`;
    if (endDate) return `Up to ${endDate}`;
    return 'Full Available History';
  }, [startDate, endDate]);

  // Render Plotly Chart
  useEffect(() => {
    if (!chartRef.current || !data || typeof Plotly === 'undefined') return;

    const traces = Object.entries(data.series).map(([stock, points], idx) => {
      const traceColor = CHART_PALETTE[idx % CHART_PALETTE.length];
      const sec = securities.find((s) => s.symbol.toUpperCase() === stock.toUpperCase());
      const comp = sec?.company_name || stock;

      return {
        x: points.map((p) => p.trade_date),
        y: points.map((p) => p.normalized_price),
        type: 'scatter',
        mode: 'lines',
        name: comp !== stock ? `${stock} (${comp})` : stock,
        line: { color: traceColor, width: 2.4 },
        hovertemplate: `<b>${stock}</b> • ${comp}<br>Date: %{x}<br>Base 100: %{y:.2f}<extra></extra>`,
      };
    });

    const dateSubtext = startDate || endDate ? ` (${activeDateSpanText})` : '';

    const layout = {
      title: {
        text: `Normalized Stock Price Performance (Base = 100)${dateSubtext}`,
        font: { color: chartTheme.font.color, size: 14, family: 'Inter, sans-serif' },
      },
      paper_bgcolor: chartTheme.paper_bgcolor,
      plot_bgcolor: chartTheme.plot_bgcolor,
      font: chartTheme.font,
      xaxis: {
        gridcolor: chartTheme.gridcolor,
        showgrid: true,
        zerolinecolor: chartTheme.zerolinecolor,
      },
      yaxis: {
        gridcolor: chartTheme.gridcolor,
        showgrid: true,
        zerolinecolor: chartTheme.zerolinecolor,
        title: { text: 'Performance (Base = 100)', font: { size: 12, color: chartTheme.font.color } },
      },
      hovermode: 'x unified',
      hoverlabel: chartTheme.hoverlabel,
      margin: { t: 50, r: 24, l: 60, b: 40 },
      legend: {
        orientation: 'h',
        y: 1.14,
        x: 0,
        font: { color: chartTheme.font.color, size: 12 },
      },
      height: 460,
    };

    Plotly.newPlot(chartRef.current, traces, layout, { responsive: true, displaylogo: false });
  }, [data, activeDateSpanText, startDate, endDate, chartTheme, securities]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Header & Stock Selection Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          backgroundColor: 'var(--bg-surface)',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Multi-Stock Comparison
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Rebased relative performance, volatility & drawdown analytics across customized time horizons.
          </div>
        </div>

        {/* Search + Stock Dropdown + Add Button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Stock Dropdown */}
          <select
            className="filter-num-input"
            style={{ minWidth: 260, maxWidth: 360, height: 36 }}
            value={dropdownValue}
            onChange={(e) => handleSelectFromDropdown(e.target.value)}
          >
            <option value="">+ Select share to add...</option>
            {filteredSecurities.length > 0 ? (
              filteredSecurities.slice(0, 3000).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.company_name && s.company_name.trim().toUpperCase() !== s.symbol.trim().toUpperCase() ? s.company_name : s.symbol}
                  {isDelisted(s) ? ` [DELISTED ${s.last_traded_date ? s.last_traded_date.slice(0, 4) : ''}]` : ''}
                </option>
              ))
            ) : (
              <option value="">No shares found</option>
            )}
          </select>

          {/* Search Input */}
          <input
            type="text"
            placeholder="🔍 Search share..."
            className="filter-num-input"
            style={{ width: 140, height: 36 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearchAddStock();
              }
            }}
          />

          {/* Add Stock Button */}
          <button
            className="btn-primary"
            onClick={handleSearchAddStock}
            style={{ height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Selected Stock Chips Display */}
      {selectedSymbols.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '10px 16px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Comparing ({selectedSymbols.length}):
          </span>

          {selectedSymbols.map((sym, idx) => {
            const sec = securities.find((s) => s.symbol.toUpperCase() === sym.toUpperCase());
            const compName = sec?.company_name;
            const traceColor = CHART_PALETTE[idx % CHART_PALETTE.length];

            return (
              <span
                key={sym}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${traceColor}`,
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                }}
              >
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: traceColor }} />
                <span>{sym}</span>
                {compName && (
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ({compName})
                  </span>
                )}
                {isDelisted(sec) && (
                  <span
                    style={{
                      fontSize: '9px',
                      color: '#ef4444',
                      fontWeight: 700,
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      letterSpacing: '0.4px',
                    }}
                    title={getDelistedNotice(sec) || 'Delisted on NSE'}
                  >
                    DELISTED
                  </span>
                )}
                <button
                  onClick={() => handleRemoveSymbol(sym)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                  title={`Remove ${sym}`}
                >
                  ✕
                </button>
              </span>
            );
          })}

          <button
            onClick={handleClearAll}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '11px',
              color: 'var(--red)',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Clear All
          </button>
        </div>
      )}

      {selectedSymbols.some((sym) => {
        const sec = securities.find((s) => s.symbol.toUpperCase() === sym.toUpperCase());
        return isDelisted(sec);
      }) && (
        <div
          style={{
            marginTop: '12px',
            marginBottom: '4px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '12px',
          }}
        >
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <div>
            <strong>Delisted Stock in Comparison:</strong> Stock(s){' '}
            <strong>
              {selectedSymbols
                .filter((sym) => isDelisted(securities.find((s) => s.symbol.toUpperCase() === sym.toUpperCase())))
                .join(', ')}
            </strong>{' '}
            are delisted or inactive on NSE. Recent data stops at their final traded date.
          </div>
        </div>
      )}

      {/* Quick Baskets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
          Quick Baskets:
        </span>
        {QUICK_BASKETS.map((b) => (
          <button
            key={b.label}
            className="filter-chip-btn"
            style={{ fontSize: '11px', padding: '4px 12px' }}
            onClick={() => handleBasketClick(b.symbols)}
          >
            {b.label} ({b.symbols.join(', ')})
          </button>
        ))}
      </div>

      {/* FILTER PANEL: FROM DATE & TO DATE CONTROLS + PRESETS */}
      <div className="seasonal-filter-panel">
        <div className="filter-row">
          <div className="filter-label-group">
            <span>📅 Date Filter:</span>
          </div>

          {/* Quick Year/Duration Presets */}
          <div className="filter-pills-row">
            <button
              className={`filter-chip-btn ${datePreset === 'all' && !startDate && !endDate ? 'active' : ''}`}
              onClick={() => applyDatePreset('all')}
            >
              All Available Data
            </button>
            <button
              className={`filter-chip-btn ${datePreset === '1y' ? 'active' : ''}`}
              onClick={() => applyDatePreset('1y')}
            >
              Last 1Y
            </button>
            <button
              className={`filter-chip-btn ${datePreset === '2y' ? 'active' : ''}`}
              onClick={() => applyDatePreset('2y')}
            >
              Last 2Y
            </button>
            <button
              className={`filter-chip-btn ${datePreset === '3y' ? 'active' : ''}`}
              onClick={() => applyDatePreset('3y')}
            >
              Last 3Y
            </button>
          </div>

          {/* Custom Date Pickers: From Date & To Date */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              borderLeft: '1px solid var(--border)',
              paddingLeft: '14px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 600 }}>From Date:</span>
            <input
              type="date"
              className="filter-num-input"
              style={{ width: '138px', colorScheme: 'dark' }}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
            />

            <span style={{ fontWeight: 600 }}>To Date:</span>
            <input
              type="date"
              className="filter-num-input"
              style={{ width: '138px', colorScheme: 'dark' }}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
            />

            <button
              className="filter-chip-btn active"
              style={{ padding: '5px 12px' }}
              onClick={() => handleCustomDateSubmit()}
            >
              Apply Date Range
            </button>

            {(startDate || endDate) && (
              <button
                className="filter-chip-btn"
                style={{ padding: '5px 10px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={handleResetDates}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Current Active Filter Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-dim)', paddingTop: '2px' }}>
          <span>Active Window:</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
            {activeDateSpanText}
          </span>
          {data && (
            <span style={{ color: 'var(--text-muted)' }}>
              • {Object.keys(data.series).length} stocks loaded
            </span>
          )}
        </div>
      </div>

      {loading && <LoadingState message="Calculating normalized returns and risk metrics for selected stocks..." />}

      {errorMsg && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '12px 16px',
            color: '#ef4444',
            fontSize: '13px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {!loading && !data && !errorMsg && (
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
            No Stocks Selected
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto' }}>
            Select stocks from the dropdown or search bar above, or choose a Quick Basket to compare relative normalized performance.
          </p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Quick Highlight Cards */}
          {statsHighlights && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Top Performer ({activeDateSpanText})
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  {statsHighlights.bestPerformer.symbol}
                </div>
                <div style={{ fontSize: '13px', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                  +{statsHighlights.bestPerformer.cumulative_return_pct}% return
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Lowest Volatility
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  {statsHighlights.lowestVol.symbol}
                </div>
                <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 600, marginTop: '2px' }}>
                  {statsHighlights.lowestVol.annualized_volatility_pct}% Ann. Vol
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Lowest Max Drawdown
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  {statsHighlights.lowestDD.symbol}
                </div>
                <div style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600, marginTop: '2px' }}>
                  {statsHighlights.lowestDD.max_drawdown_pct}% Max Drawdown
                </div>
              </div>
            </div>
          )}

          {/* Plotly Chart Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div ref={chartRef} style={{ width: '100%', height: '460px' }} />
          </div>

          {/* Statistics Table Card */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                Risk-Adjusted Performance Comparison ({activeDateSpanText})
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Rebased to 100 on initial trading date of selected period
              </span>
            </div>

            <div className="terminal-table-wrapper">
              <table className="terminal-table">
                <thead>
                  <tr>
                    <th>Symbol & Company</th>
                    <th>Base Price</th>
                    <th>Latest Close</th>
                    <th>Cumulative Return %</th>
                    <th>Annualized Volatility %</th>
                    <th>Max Drawdown %</th>
                    <th>Data Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.map((s, idx) => {
                    const sec = securities.find((secItem) => secItem.symbol.toUpperCase() === s.symbol.toUpperCase());
                    const compName = sec?.company_name;
                    const traceColor = CHART_PALETTE[idx % CHART_PALETTE.length];

                    return (
                      <tr key={s.symbol}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: traceColor }} />
                            <div>
                              <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{s.symbol}</strong>
                              {compName && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{compName}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>₹{s.base_price.toFixed(2)}</td>
                        <td>₹{s.latest_close.toFixed(2)}</td>
                        <td className={s.cumulative_return_pct >= 0 ? 'text-gainer' : 'text-loser'}>
                          {s.cumulative_return_pct >= 0 ? '+' : ''}
                          {s.cumulative_return_pct}%
                        </td>
                        <td>{s.annualized_volatility_pct}%</td>
                        <td className="text-loser">{s.max_drawdown_pct}%</td>
                        <td>{s.data_points.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
