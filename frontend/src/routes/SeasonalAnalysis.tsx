import React, { useEffect, useState, useMemo, useRef } from 'react';
import { SeasonalityData, SecurityMasterItem } from '../types';
import { fetchSeasonality, fetchSecurities } from '../services/api';
import { isShare, resolveCanonicalSymbol, isDelisted, getDelistedNotice } from '../utils/securityUtils';
import { SeasonalChart } from '../components/charts/SeasonalChart';
import { LoadingState } from '../components/common/LoadingState';
import { Search, ChevronDown, X, Check, AlertCircle } from 'lucide-react';

type PeriodType = 'weekly' | 'monthly' | 'quarterly';
type ReturnPresetType = 'all' | 'pos' | 'neg' | 'gain5' | 'loss5' | 'extreme' | 'custom';
type YearPresetType = 'all' | 'last3' | 'last5' | 'last10' | 'custom';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const QUARTER_NAMES = ['Q1', 'Q2', 'Q3', 'Q4'];
const WEEK_NAMES = Array.from({ length: 52 }, (_, i) => `W${i + 1}`);

export const SeasonalAnalysis: React.FC = () => {
  const [symbol, setSymbol] = useState(() => {
    const stored = sessionStorage.getItem('selected_stock_symbol');
    return stored ? resolveCanonicalSymbol(stored) : '';
  });
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [data, setData] = useState<SeasonalityData | null>(null);
  const [loading, setLoading] = useState(false);

  // Securities List for Dropdown with Company Names
  const [securities, setSecurities] = useState<SecurityMasterItem[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Date Filter State
  const [yearPreset, setYearPreset] = useState<YearPresetType>('all');
  const [startYear, setStartYear] = useState<number | null>(null);
  const [endYear, setEndYear] = useState<number | null>(null);

  // Custom Date Picker State
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Return % Filter State
  const [returnPreset, setReturnPreset] = useState<ReturnPresetType>('all');
  const [minReturn, setMinReturn] = useState<string>('');
  const [maxReturn, setMaxReturn] = useState<string>('');

  // Load Securities Master list on mount (Shares only, excluding ETFs and mutual funds)
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
          // Sort alphabetically by symbol
          const sorted = deduped.sort((a, b) => a.symbol.localeCompare(b.symbol));
          setSecurities(sorted);
        }
      })
      .catch((err) => console.error('Failed to fetch securities:', err));
  }, []);

  const resolveSymbol = (sym: string): string => {
    return resolveCanonicalSymbol(sym);
  };

  const loadSeasonality = (sym: string, startD?: string, endD?: string) => {
    const cleanSym = resolveSymbol(sym);
    if (!cleanSym) return;
    setSymbol(cleanSym);
    setLoading(true);
    setData(null);
    sessionStorage.setItem('selected_stock_symbol', cleanSym);
    fetchSeasonality(cleanSym, 'EQ', undefined, undefined, startD || undefined, endD || undefined)
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
      loadSeasonality(initialSym);
    }
  }, []);

  // Find active security & formatted title
  const activeSec = securities.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
  const activeCompanyName =
    activeSec?.company_name && activeSec.company_name.trim().toUpperCase() !== symbol.trim().toUpperCase()
      ? activeSec.company_name
      : null;
  const stockDisplayTitle = activeCompanyName ? `${symbol} — ${activeCompanyName}` : symbol;

  // Sync search input with currently selected stock when dropdown is closed
  useEffect(() => {
    if (symbol && !isDropdownOpen) {
      const sec = securities.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
      if (sec) {
        setStockSearchQuery(
          sec.company_name && sec.company_name.trim().toUpperCase() !== sec.symbol.trim().toUpperCase()
            ? `${sec.symbol} — ${sec.company_name}`
            : sec.symbol
        );
      } else {
        setStockSearchQuery(symbol);
      }
    }
  }, [symbol, securities, isDropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered list of shares based on search query (excluding ETFs)
  const filteredSecurities = useMemo(() => {
    const raw = stockSearchQuery.trim();
    const baseShares = securities.filter(isShare);
    if (!raw) return baseShares;

    // If query matches currently selected symbol + company, don't overfilter
    if (raw.toUpperCase() === stockDisplayTitle.toUpperCase() && !isDropdownOpen) {
      return baseShares;
    }

    const q = raw.includes('—') ? raw.split('—')[0].trim().toUpperCase() : raw.toUpperCase();
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
      if (aSym.startsWith(q) && !bSym.startsWith(q)) return -1;
      if (bSym.startsWith(q) && !aSym.startsWith(q)) return 1;
      return aSym.localeCompare(bSym);
    });
  }, [securities, stockSearchQuery, isDropdownOpen, stockDisplayTitle]);

  const handleSelectStock = (sec: SecurityMasterItem) => {
    const sym = sec.symbol.trim().toUpperCase();
    setIsDropdownOpen(false);
    setStockSearchQuery(
      sec.company_name && sec.company_name.trim().toUpperCase() !== sym
        ? `${sym} — ${sec.company_name}`
        : sym
    );
    loadSeasonality(sym);
  };

  // Determine active columns based on period
  const getActiveColumns = (): string[] => {
    if (period === 'weekly') return WEEK_NAMES;
    if (period === 'quarterly') return QUARTER_NAMES;
    return MONTH_NAMES;
  };

  const getRawRows = () => {
    if (!data) return [];
    if (period === 'weekly' && data.weekly) {
      return data.weekly.rows || [];
    }
    if (period === 'quarterly' && data.quarterly) {
      return data.quarterly.rows || [];
    }
    if (data.monthly) {
      return data.monthly.rows || [];
    }
    return (data.heatmap || []).map((r) => ({
      year: r.year,
      January: r.Jan,
      February: r.Feb,
      March: r.Mar,
      April: r.Apr,
      May: r.May,
      June: r.Jun,
      July: r.Jul,
      August: r.Aug,
      September: r.Sep,
      October: r.Oct,
      November: r.Nov,
      December: r.Dec,
    }));
  };

  const rawRows = getRawRows();

  // Extract all available years in dataset
  const availableYears = useMemo(() => {
    if (!rawRows || rawRows.length === 0) return [];
    const yrs = Array.from(new Set(rawRows.map((r) => r.year))).sort((a, b) => b - a);
    return yrs;
  }, [rawRows]);

  const maxAvailableYear = availableYears.length > 0 ? availableYears[0] : 2026;
  const minAvailableYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : 2001;

  // Handle Year Presets
  const applyYearPreset = (preset: YearPresetType) => {
    setYearPreset(preset);
    setCustomStartDate('');
    setCustomEndDate('');
    if (preset === 'all') {
      setStartYear(null);
      setEndYear(null);
    } else if (preset === 'last3') {
      setStartYear(maxAvailableYear - 2);
      setEndYear(maxAvailableYear);
    } else if (preset === 'last5') {
      setStartYear(maxAvailableYear - 4);
      setEndYear(maxAvailableYear);
    } else if (preset === 'last10') {
      setStartYear(maxAvailableYear - 9);
      setEndYear(maxAvailableYear);
    }
  };

  // Handle Custom Date Range application
  const applyCustomDateRange = () => {
    if (!customStartDate && !customEndDate) return;
    setYearPreset('custom');
    if (customStartDate) {
      const sY = parseInt(customStartDate.split('-')[0]);
      setStartYear(sY);
    }
    if (customEndDate) {
      const eY = parseInt(customEndDate.split('-')[0]);
      setEndYear(eY);
    }
    // Fetch directly from server with bounded dates
    loadSeasonality(symbol, customStartDate, customEndDate);
  };

  // Filter rows by Date Range / Custom Dates
  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      if (startYear !== null && r.year < startYear) return false;
      if (endYear !== null && r.year > endYear) return false;
      return true;
    });
  }, [rawRows, startYear, endYear]);

  // Handle Return % Presets
  const applyReturnPreset = (preset: ReturnPresetType) => {
    setReturnPreset(preset);
    if (preset === 'all') {
      setMinReturn('');
      setMaxReturn('');
    } else if (preset === 'pos') {
      setMinReturn('0.01');
      setMaxReturn('');
    } else if (preset === 'neg') {
      setMinReturn('');
      setMaxReturn('-0.01');
    } else if (preset === 'gain5') {
      setMinReturn('5.0');
      setMaxReturn('');
    } else if (preset === 'loss5') {
      setMinReturn('');
      setMaxReturn('-5.0');
    } else if (preset === 'extreme') {
      setMinReturn('10.0');
      setMaxReturn('');
    }
  };

  // Check if cell return value matches return filter
  const checkReturnMatch = (val: number | null | undefined): boolean => {
    if (val === null || val === undefined) return false;

    if (returnPreset === 'extreme') {
      return Math.abs(val) >= 10.0;
    }

    const minNum = minReturn !== '' ? parseFloat(minReturn) : null;
    const maxNum = maxReturn !== '' ? parseFloat(maxReturn) : null;

    if (minNum !== null && val < minNum) return false;
    if (maxNum !== null && val > maxNum) return false;

    return true;
  };

  const isReturnFilterActive = returnPreset !== 'all' || minReturn !== '' || maxReturn !== '';

  const formatReturn = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${val.toFixed(2)}%`;
  };

  // Dynamically compute summary metrics (Average, Median, Win Rate) for the filtered rows & period
  const activeColumns = getActiveColumns();

  const dynamicSummary = useMemo(() => {
    const avg: Record<string, number> = {};
    const med: Record<string, number> = {};
    const win: Record<string, number> = {};
    const loss: Record<string, number> = {};
    const posCounts: Record<string, number> = {};
    const totalCounts: Record<string, number> = {};

    activeColumns.forEach((col) => {
      const values: number[] = [];
      filteredRows.forEach((r) => {
        const v = r[col];
        if (typeof v === 'number' && !isNaN(v)) {
          values.push(v);
        }
      });

      if (values.length > 0) {
        const sum = values.reduce((acc, curr) => acc + curr, 0);
        avg[col] = Math.round((sum / values.length) * 100) / 100;

        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        med[col] = sorted.length % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;

        const posCount = values.filter((v) => v > 0).length;
        const negCount = values.filter((v) => v < 0).length;
        win[col] = Math.round((posCount / values.length) * 1000) / 10;
        loss[col] = Math.round((negCount / values.length) * 1000) / 10;
        posCounts[col] = posCount;
        totalCounts[col] = values.length;
      }
    });

    // Probability ranking
    const rankedColumns = [...activeColumns]
      .filter((col) => win[col] !== undefined)
      .sort((a, b) => (win[b] ?? 0) - (win[a] ?? 0));

    const highestProb = rankedColumns.length > 0 ? {
      period: rankedColumns[0],
      prob: win[rankedColumns[0]],
      avg: avg[rankedColumns[0]],
      wins: posCounts[rankedColumns[0]],
      total: totalCounts[rankedColumns[0]],
    } : null;

    const lowestProb = rankedColumns.length > 0 ? {
      period: rankedColumns[rankedColumns.length - 1],
      prob: win[rankedColumns[rankedColumns.length - 1]],
      avg: avg[rankedColumns[rankedColumns.length - 1]],
      wins: posCounts[rankedColumns[rankedColumns.length - 1]],
      total: totalCounts[rankedColumns[rankedColumns.length - 1]],
    } : null;

    const bullishPeriodsCount = activeColumns.filter((c) => (win[c] ?? 0) >= 50).length;

    return {
      average: avg,
      median: med,
      win_rates: win,
      loss_rates: loss,
      posCounts,
      totalCounts,
      highestProb,
      lowestProb,
      bullishPeriodsCount,
    };
  }, [filteredRows, activeColumns]);

  // Live return filter match stats
  const filterStats = useMemo(() => {
    let totalCells = 0;
    let matchedCells = 0;
    let sumMatched = 0;

    filteredRows.forEach((r) => {
      activeColumns.forEach((col) => {
        const val = r[col];
        if (typeof val === 'number' && !isNaN(val)) {
          totalCells++;
          if (checkReturnMatch(val)) {
            matchedCells++;
            sumMatched += val;
          }
        }
      });
    });

    const matchPct = totalCells > 0 ? Math.round((matchedCells / totalCells) * 1000) / 10 : 0;
    const avgMatched = matchedCells > 0 ? Math.round((sumMatched / matchedCells) * 100) / 100 : 0;

    return { totalCells, matchedCells, matchPct, avgMatched };
  }, [filteredRows, activeColumns, returnPreset, minReturn, maxReturn]);

  const resetAllFilters = () => {
    applyYearPreset('all');
    applyReturnPreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    loadSeasonality(symbol);
  };

  const getCellTooltip = (year: number, col: string, val: number | null | undefined, formatted: string): string => {
    if (val !== null && val !== undefined) {
      return `${year} ${col}: ${formatted}`;
    }
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const monthMap: Record<string, number> = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
    };
    const mNum = monthMap[col];
    if (year > curYear || (year === curYear && mNum && mNum > curMonth)) {
      return `${year} ${col}: Future period (Unoccurred)`;
    }
    return `${year} ${col}: No trading activity on NSE (Trading Halted / Suspended / Nil volume)`;
  };

  const getTileClasses = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return 'matrix-tile tile-empty';

    const matches = checkReturnMatch(val);

    if (isReturnFilterActive) {
      if (!matches) {
        return val > 0 ? 'matrix-tile tile-positive tile-dimmed' : 'matrix-tile tile-negative tile-dimmed';
      }
      return val > 0 ? 'matrix-tile tile-positive tile-highlighted' : 'matrix-tile tile-negative tile-highlighted';
    }

    if (val > 0) return 'matrix-tile tile-positive';
    if (val < 0) return 'matrix-tile tile-negative';
    return 'matrix-tile';
  };

  const periodDisplayName = period === 'weekly' ? 'Weekly' : (period === 'quarterly' ? 'Quarterly' : 'Monthly');

  return (
    <div>
      {/* 1. Main Header & Stock Selector with Company Names */}
      <div className="seasonal-card">
        {/* Top Header Banner: Scrip Name + Company Name */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Seasonal Analysis
            </h2>
            {symbol && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  backgroundColor: 'var(--bg-card)',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{symbol}</span>
                {activeCompanyName && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    — {activeCompanyName}
                  </span>
                )}
              </span>
            )}
            {(isDelisted(activeSec) || data?.is_delisted) && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  letterSpacing: '0.4px',
                }}
                title={getDelistedNotice(activeSec) || 'Delisted on NSE'}
              >
                <AlertCircle size={13} />
                <span>DELISTED / INACTIVE ON NSE {activeSec?.last_traded_date ? `(${activeSec.last_traded_date.slice(0, 4)})` : ''}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Historical Multi-Year Seasonal Return Distribution Matrix & Statistical Probability Analysis
          </div>
          {(isDelisted(activeSec) || data?.is_delisted) && (
            <div
              style={{
                marginTop: '12px',
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
              <AlertCircle size={18} style={{ flexShrink: 0, color: '#f59e0b' }} />
              <div>
                <strong style={{ color: '#fbbf24' }}>NSE Delisted / Suspended Notice:</strong> Current live data is not available on NSE for <strong>{symbol}</strong> because it was delisted or suspended from trading (last recorded trading session was <strong>{activeSec?.last_traded_date || data?.end_date || 'May 06, 2009'}</strong>). Full historical data archive is available below.
              </div>
            </div>
          )}
        </div>

        <div className="seasonal-header-row" style={{ alignItems: 'flex-start' }}>
          {/* Interactive Search Bar Combobox Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative', flex: 1, minWidth: 320, maxWidth: 540 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                ref={inputRef}
                type="text"
                className="filter-num-input"
                style={{
                  width: '100%',
                  height: '40px',
                  paddingLeft: '38px',
                  paddingRight: '68px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card)',
                  border: isDropdownOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  boxShadow: isDropdownOpen ? '0 0 0 2px var(--accent-alpha)' : 'none',
                  outline: 'none',
                  transition: 'all 0.15s ease',
                }}
                placeholder="🔍 Search share or company (e.g. RELIANCE, TCS, INFY)..."
                value={stockSearchQuery}
                onFocus={() => {
                  setIsDropdownOpen(true);
                }}
                onChange={(e) => {
                  setStockSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                  } else if (e.key === 'Enter') {
                    if (filteredSecurities.length > 0) {
                      handleSelectStock(filteredSecurities[0]);
                    }
                  }
                }}
              />

              <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {stockSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setStockSearchQuery('');
                      setIsDropdownOpen(true);
                      inputRef.current?.focus();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen((prev) => !prev);
                    if (!isDropdownOpen) inputRef.current?.focus();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Toggle stock list"
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Interactive Dropdown Menu */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  maxHeight: '360px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.4), 0 4px 10px rgba(0, 0, 0, 0.3)',
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-dim)',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>SELECT SHARE ({filteredSecurities.length} found)</span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(37, 99, 235, 0.12)',
                        color: 'var(--accent)',
                        letterSpacing: '0.5px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      SHARES ONLY
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Click to load seasonal returns</span>
                </div>

                {filteredSecurities.length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No equity shares found matching "{stockSearchQuery}"
                  </div>
                ) : (
                  filteredSecurities.slice(0, 300).map((sec) => {
                    const isSelected = sec.symbol.toUpperCase() === symbol.toUpperCase();
                    const hasDistinctName =
                      sec.company_name && sec.company_name.trim().toUpperCase() !== sec.symbol.trim().toUpperCase();
                    return (
                      <div
                        key={sec.symbol}
                        onClick={() => handleSelectStock(sec)}
                        style={{
                          padding: '9px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: isSelected ? 'var(--accent-alpha)' : 'transparent',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: isSelected ? 'var(--accent)' : 'var(--text-main)',
                              backgroundColor: isSelected ? 'var(--accent-alpha)' : 'var(--bg-card)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              letterSpacing: '0.5px',
                              flexShrink: 0,
                            }}
                          >
                            {sec.symbol}
                          </span>

                          {hasDistinctName && (
                            <span
                              style={{
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={sec.company_name!}
                            >
                              {sec.company_name}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {isDelisted(sec) ? (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                letterSpacing: '0.4px',
                                whiteSpace: 'nowrap',
                                fontFamily: 'JetBrains Mono, monospace',
                              }}
                              title={getDelistedNotice(sec) || 'Delisted / Inactive on NSE'}
                            >
                              DELISTED {sec.last_traded_date ? `(${sec.last_traded_date.slice(0, 4)})` : ''}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                letterSpacing: '0.4px',
                              }}
                            >
                              ACTIVE
                            </span>
                          )}

                          {isSelected && (
                            <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 'bold' }}>✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Period Tabs: Weekly, Monthly, Quarterly (Daily removed as requested) */}
          <div className="period-pill-group">
            <button
              className={`period-pill-btn ${period === 'weekly' ? 'active' : ''}`}
              onClick={() => setPeriod('weekly')}
            >
              Weekly returns(%)
            </button>
            <button
              className={`period-pill-btn ${period === 'monthly' ? 'active' : ''}`}
              onClick={() => setPeriod('monthly')}
            >
              Monthly returns(%)
            </button>
            <button
              className={`period-pill-btn ${period === 'quarterly' ? 'active' : ''}`}
              onClick={() => setPeriod('quarterly')}
            >
              Quarterly returns(%)
            </button>
          </div>
        </div>

        {/* 2. Interactive Filter Toolbar (Date Picker & Return % Filters) */}
        <div className="seasonal-filter-panel">
          {/* A. DATE RANGE & CUSTOM DATE PICKER ROW */}
          <div className="filter-row">
            <div className="filter-label-group">
              <span>📅 Date Filter:</span>
            </div>

            {/* Quick Year Presets */}
            <div className="filter-pills-row">
              <button
                className={`filter-chip-btn ${yearPreset === 'all' && !customStartDate && !customEndDate ? 'active' : ''}`}
                onClick={() => applyYearPreset('all')}
              >
                All Years ({minAvailableYear}–{maxAvailableYear})
              </button>
              <button
                className={`filter-chip-btn ${yearPreset === 'last3' ? 'active' : ''}`}
                onClick={() => applyYearPreset('last3')}
              >
                Last 3Y
              </button>
              <button
                className={`filter-chip-btn ${yearPreset === 'last5' ? 'active' : ''}`}
                onClick={() => applyYearPreset('last5')}
              >
                Last 5Y
              </button>
              <button
                className={`filter-chip-btn ${yearPreset === 'last10' ? 'active' : ''}`}
                onClick={() => applyYearPreset('last10')}
              >
                Last 10Y
              </button>
            </div>

            {/* From / To Year Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>From Yr:</span>
              <select
                className="filter-num-input"
                style={{ width: 85 }}
                value={startYear ?? ''}
                onChange={(e) => {
                  setYearPreset('custom');
                  setStartYear(e.target.value ? parseInt(e.target.value) : null);
                }}
              >
                <option value="">Start</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <span>To Yr:</span>
              <select
                className="filter-num-input"
                style={{ width: 85 }}
                value={endYear ?? ''}
                onChange={(e) => {
                  setYearPreset('custom');
                  setEndYear(e.target.value ? parseInt(e.target.value) : null);
                }}
              >
                <option value="">End</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Custom Date Picker (From Date / To Date) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
              <span>From Date:</span>
              <input
                type="date"
                className="filter-num-input"
                style={{ width: 135 }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span>To Date:</span>
              <input
                type="date"
                className="filter-num-input"
                style={{ width: 135 }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
              <button
                className="filter-chip-btn active"
                style={{ padding: '4px 10px' }}
                onClick={applyCustomDateRange}
              >
                Apply Date Range
              </button>
            </div>
          </div>

          {/* B. RETURN PERCENTAGE FILTER ROW */}
          <div className="filter-row">
            <div className="filter-label-group">
              <span>⚡ Return % Filter:</span>
            </div>

            <div className="filter-pills-row">
              <button
                className={`filter-chip-btn ${returnPreset === 'all' && minReturn === '' && maxReturn === '' ? 'active' : ''}`}
                onClick={() => applyReturnPreset('all')}
              >
                All Returns
              </button>
              <button
                className={`filter-chip-btn ${returnPreset === 'pos' ? 'active' : ''}`}
                onClick={() => applyReturnPreset('pos')}
              >
                Gains (&gt; 0%)
              </button>
              <button
                className={`filter-chip-btn ${returnPreset === 'neg' ? 'active' : ''}`}
                onClick={() => applyReturnPreset('neg')}
              >
                Losses (&lt; 0%)
              </button>
              <button
                className={`filter-chip-btn ${returnPreset === 'gain5' ? 'active' : ''}`}
                onClick={() => applyReturnPreset('gain5')}
              >
                Big Gains (≥ +5%)
              </button>
              <button
                className={`filter-chip-btn ${returnPreset === 'loss5' ? 'active' : ''}`}
                onClick={() => applyReturnPreset('loss5')}
              >
                Big Losses (≤ -5%)
              </button>
              <button
                className={`filter-chip-btn ${returnPreset === 'extreme' ? 'active' : ''}`}
                onClick={() => applyReturnPreset('extreme')}
              >
                Extreme (|Ret| ≥ 10%)
              </button>
            </div>

            {/* Custom Min / Max % Inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Min %:</span>
              <input
                type="number"
                step="0.5"
                placeholder="-5.0"
                className="filter-num-input"
                value={minReturn}
                onChange={(e) => {
                  setReturnPreset('custom');
                  setMinReturn(e.target.value);
                }}
              />
              <span>Max %:</span>
              <input
                type="number"
                step="0.5"
                placeholder="10.0"
                className="filter-num-input"
                value={maxReturn}
                onChange={(e) => {
                  setReturnPreset('custom');
                  setMaxReturn(e.target.value);
                }}
              />
            </div>
          </div>

          {/* C. ACTIVE FILTER STATS & RESET ROW */}
          {(isReturnFilterActive || yearPreset !== 'all' || startYear !== null || endYear !== null || customStartDate || customEndDate) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="filter-stats-badge">
                <span>🎯 Matched ({periodDisplayName}): {filterStats.matchedCells} / {filterStats.totalCells} cells ({filterStats.matchPct}%)</span>
                <span>•</span>
                <span>Filtered Avg: {filterStats.avgMatched >= 0 ? '+' : ''}{filterStats.avgMatched}%</span>
                <span>•</span>
                <span>Filtered Years: {filteredRows.length} yrs</span>
              </div>

              <button className="filter-reset-btn" onClick={resetAllFilters}>
                ✕ Reset All Filters
              </button>
            </div>
          )}
        </div>

        {loading && (
          <LoadingState
            message={`Calculating ${period} seasonality for ${symbol}${activeCompanyName ? ` — ${activeCompanyName}` : ''}...`}
          />
        )}

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
              Search or select a stock from the dropdown above to view seasonal returns and probability win rates.
            </p>
          </div>
        )}

        {/* 3. Seasonal Matrix Table */}
        {!loading && data && (
          <>
            <div className="matrix-container">
              <table className="seasonal-matrix-table">
                <thead>
                  <tr>
                    <th className="time-th">Time</th>
                    {activeColumns.map((col) => (
                      <th key={col} style={{ minWidth: period === 'weekly' ? 44 : undefined, padding: period === 'weekly' ? '8px 2px' : undefined }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Historical Year Rows (Descending, filtered by Date Range & Custom Date Picker) */}
                  {filteredRows.map((row) => (
                    <tr key={row.year}>
                      <td className="matrix-row-year">{row.year}</td>
                      {activeColumns.map((col) => {
                        const val = row[col] as number | null | undefined;
                        const formatted = formatReturn(val);

                        return (
                          <td key={col} style={{ padding: 0 }}>
                            <div
                              className={getTileClasses(val)}
                              style={{
                                fontSize: period === 'weekly' ? 10 : 12,
                                padding: period === 'weekly' ? '8px 2px' : '11px 4px',
                              }}
                              title={getCellTooltip(row.year, col, val, formatted)}
                            >
                              {formatted}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Dynamic Summary Rows (Average, Median, Win Probability %, Loss Probability %) */}
                  <tr className="matrix-summary-row">
                    <td className="matrix-summary-label">Average</td>
                    {activeColumns.map((col) => {
                      const avgVal = dynamicSummary.average[col];
                      return (
                        <td key={col} style={{ padding: 0 }}>
                          <div
                            className="matrix-summary-tile"
                            style={{
                              fontSize: period === 'weekly' ? 10 : 12,
                              padding: period === 'weekly' ? '8px 2px' : '10px 4px',
                            }}
                            title={`Average ${periodDisplayName} return for ${col} across ${filteredRows.length} filtered years`}
                          >
                            {avgVal !== undefined ? formatReturn(avgVal) : '--'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="matrix-summary-row">
                    <td className="matrix-summary-label">Median</td>
                    {activeColumns.map((col) => {
                      const medVal = dynamicSummary.median[col];
                      return (
                        <td key={col} style={{ padding: 0 }}>
                          <div
                            className="matrix-summary-tile"
                            style={{
                              fontSize: period === 'weekly' ? 10 : 12,
                              padding: period === 'weekly' ? '8px 2px' : '10px 4px',
                            }}
                            title={`Median ${periodDisplayName} return for ${col} across ${filteredRows.length} filtered years`}
                          >
                            {medVal !== undefined ? formatReturn(medVal) : '--'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="matrix-summary-row">
                    <td className="matrix-summary-label" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                      Win Prob (%)
                    </td>
                    {activeColumns.map((col) => {
                      const winVal = dynamicSummary.win_rates[col];
                      const wins = dynamicSummary.posCounts?.[col] ?? 0;
                      const total = dynamicSummary.totalCounts?.[col] ?? 0;
                      const tileClass =
                        winVal >= 60 ? 'prob-tile-high' : winVal >= 50 ? 'prob-tile-med' : 'prob-tile-low';
                      return (
                        <td key={col} style={{ padding: 0 }}>
                          <div
                            className={tileClass}
                            style={{
                              fontSize: period === 'weekly' ? 10 : 12,
                              padding: period === 'weekly' ? '8px 2px' : '10px 4px',
                            }}
                            title={`Historical Win Probability: ${winVal !== undefined ? winVal.toFixed(1) : '--'}% (${wins} of ${total} years positive)`}
                          >
                            {winVal !== undefined ? `${winVal.toFixed(1)}%` : '--'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="matrix-summary-row">
                    <td className="matrix-summary-label" style={{ color: 'var(--text-muted)' }}>
                      Loss Prob (%)
                    </td>
                    {activeColumns.map((col) => {
                      const lossVal = dynamicSummary.loss_rates?.[col];
                      const total = dynamicSummary.totalCounts?.[col] ?? 0;
                      const losses = total - (dynamicSummary.posCounts?.[col] ?? 0);
                      return (
                        <td key={col} style={{ padding: 0 }}>
                          <div
                            className="matrix-summary-tile"
                            style={{
                              fontSize: period === 'weekly' ? 10 : 12,
                              padding: period === 'weekly' ? '8px 2px' : '10px 4px',
                              color: 'var(--text-muted)',
                            }}
                            title={`Historical Loss Probability: ${lossVal !== undefined ? lossVal.toFixed(1) : '--'}% (${losses} of ${total} years negative)`}
                          >
                            {lossVal !== undefined ? `${lossVal.toFixed(1)}%` : '--'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Informative Matrix Legend */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: 16,
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 12,
              paddingRight: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--tile-pos-bg)', border: '1px solid var(--tile-pos-border)' }} />
                <span>Positive Return</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--tile-neg-bg)', border: '1px solid var(--tile-neg-border)' }} />
                <span>Negative Return</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: '1px dashed var(--border)', backgroundColor: 'var(--tile-empty-bg)' }} />
                <span>No Trades on NSE (Trading Halted / Nil Volume)</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. Visual Analytics Chart */}
      {!loading && data && (
        <SeasonalChart
          symbol={symbol}
          monthlyAverages={dynamicSummary.average}
          winRates={dynamicSummary.win_rates}
          periodLabel={periodDisplayName}
        />
      )}
    </div>
  );
};
