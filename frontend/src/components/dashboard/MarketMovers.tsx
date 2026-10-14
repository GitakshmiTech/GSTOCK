import React, { useState } from 'react';
import { MarketMover } from '../../types';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface MarketMoversProps {
  gainers: MarketMover[];
  losers: MarketMover[];
  mostActive?: MarketMover[];
  onSelectStock?: (symbol: string) => void;
}

export const MarketMovers: React.FC<MarketMoversProps> = ({
  gainers,
  losers,
  mostActive = [],
  onSelectStock,
}) => {
  const [activeTab, setActiveTab] = useState<'movers' | 'active'>('movers');
  const [showTopCount, setShowTopCount] = useState<5 | 10>(5);

  const topGainers = (gainers || []).slice(0, showTopCount);
  const topLosers = (losers || []).slice(0, showTopCount);
  const topActive = (mostActive || []).slice(0, showTopCount);

  const maxGain = topGainers.length > 0 ? Math.max(...topGainers.map((g) => Math.abs(g.change_pct)), 1) : 1;
  const maxLoss = topLosers.length > 0 ? Math.max(...topLosers.map((l) => Math.abs(l.change_pct)), 1) : 1;

  const handleStockClick = (symbol: string) => {
    sessionStorage.setItem('selected_stock_symbol', symbol);
    if (onSelectStock) {
      onSelectStock(symbol);
    }
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1e7) return `${(vol / 1e7).toFixed(2)} Cr`;
    if (vol >= 1e5) return `${(vol / 1e5).toFixed(2)} L`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)} K`;
    return vol.toLocaleString();
  };

  const formatTurnover = (t: number) => {
    if (t >= 1e7) return `₹${(t / 1e7).toFixed(2)} Cr`;
    if (t >= 1e5) return `₹${(t / 1e5).toFixed(2)} L`;
    return `₹${t.toLocaleString()}`;
  };

  return (
    <div>
      {/* Subheader and Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Market Movers Snapshot</span>
          </h3>
          <span style={{
            fontSize: '11px',
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Cash Segment (EQ)
          </span>
        </div>

        {/* View Toggle Tabs */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => setShowTopCount(5)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                backgroundColor: showTopCount === 5 ? 'var(--accent)' : 'transparent',
                color: showTopCount === 5 ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Top 5 (Focus)
            </button>
            <button
              onClick={() => setShowTopCount(10)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                backgroundColor: showTopCount === 10 ? 'var(--accent)' : 'transparent',
                color: showTopCount === 10 ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Top 10
            </button>
          </div>

          {topActive.length > 0 && (
            <button
              onClick={() => setActiveTab(activeTab === 'movers' ? 'active' : 'movers')}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: activeTab === 'active' ? 'var(--nav-active-bg)' : 'var(--bg-surface)',
                color: activeTab === 'active' ? 'var(--accent)' : 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Activity size={13} />
              {activeTab === 'movers' ? 'View Turnover Leaders' : 'View Top Gainers & Losers'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'movers' ? (
        /* Top 5 Gainers & Top 5 Losers Grid */
        <div className="mover-card-grid">
          {/* TOP 5 GAINERS CONTAINER */}
          <div className="mover-container">
            <div className="mover-header-gainer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: 'var(--green)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <TrendingUp size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ▲ TOP {showTopCount} GAINERS
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Highest percentage price appreciation
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--green)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}>
                Bullish
              </span>
            </div>

            {/* List of Gainers */}
            <div>
              {topGainers.length > 0 ? (
                topGainers.map((stock, idx) => {
                  const changeAmount = stock.change ?? (stock.close_price - stock.prev_close);
                  const barPercent = Math.min(100, Math.round((Math.abs(stock.change_pct) / maxGain) * 100));

                  return (
                    <div
                      key={stock.symbol}
                      className="mover-item-card"
                      onClick={() => handleStockClick(stock.symbol)}
                      title={`Click to open ${stock.symbol} in Stock Explorer`}
                    >
                      {/* Left: Rank & Stock info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0', flex: 1 }}>
                        <div className="mover-rank-badge rank-gainer">
                          #{idx + 1}
                        </div>
                        <div style={{ minWidth: '0', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontWeight: 700,
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: '13px',
                              color: 'var(--text-main)',
                            }}>
                              {stock.symbol}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              color: 'var(--text-dim)',
                              backgroundColor: 'var(--bg-hover)',
                              padding: '1px 5px',
                              borderRadius: '3px',
                            }}>
                              {stock.series}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginTop: '1px',
                          }}>
                            {stock.company_name || stock.symbol}
                          </div>
                          {/* Mini Progress Bar showing relative gain */}
                          <div className="mover-bar-track" style={{ maxWidth: '140px' }}>
                            <div className="mover-bar-fill-gainer" style={{ width: `${barPercent}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Middle: Volume / Turnover */}
                      <div className="mover-extra-stats">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Vol: {formatVolume(stock.volume)}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          {formatTurnover(stock.turnover)}
                        </div>
                      </div>

                      {/* Right: Price & UP Sign Badge */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          fontSize: '14px',
                          color: 'var(--text-main)',
                        }}>
                          ₹{stock.close_price.toFixed(2)}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--green)',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 500,
                          marginTop: '1px',
                        }}>
                          +₹{changeAmount.toFixed(2)}
                        </div>
                      </div>

                      {/* UP Sign Badge */}
                      <div className="mover-sign-badge badge-up">
                        <ArrowUpRight size={14} strokeWidth={2.5} />
                        <span>+{stock.change_pct}%</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No gainer data available for this session
                </div>
              )}
            </div>
          </div>

          {/* TOP 5 LOSERS CONTAINER */}
          <div className="mover-container">
            <div className="mover-header-loser">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: 'var(--red)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <TrendingDown size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ▼ TOP {showTopCount} LOSERS
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Deepest percentage price decline
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--red)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}>
                Bearish
              </span>
            </div>

            {/* List of Losers */}
            <div>
              {topLosers.length > 0 ? (
                topLosers.map((stock, idx) => {
                  const changeAmount = stock.change ?? (stock.close_price - stock.prev_close);
                  const barPercent = Math.min(100, Math.round((Math.abs(stock.change_pct) / maxLoss) * 100));

                  return (
                    <div
                      key={stock.symbol}
                      className="mover-item-card"
                      onClick={() => handleStockClick(stock.symbol)}
                      title={`Click to open ${stock.symbol} in Stock Explorer`}
                    >
                      {/* Left: Rank & Stock info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0', flex: 1 }}>
                        <div className="mover-rank-badge rank-loser">
                          #{idx + 1}
                        </div>
                        <div style={{ minWidth: '0', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontWeight: 700,
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: '13px',
                              color: 'var(--text-main)',
                            }}>
                              {stock.symbol}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              color: 'var(--text-dim)',
                              backgroundColor: 'var(--bg-hover)',
                              padding: '1px 5px',
                              borderRadius: '3px',
                            }}>
                              {stock.series}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginTop: '1px',
                          }}>
                            {stock.company_name || stock.symbol}
                          </div>
                          {/* Mini Progress Bar showing relative loss */}
                          <div className="mover-bar-track" style={{ maxWidth: '140px' }}>
                            <div className="mover-bar-fill-loser" style={{ width: `${barPercent}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Middle: Volume / Turnover */}
                      <div className="mover-extra-stats">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Vol: {formatVolume(stock.volume)}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          {formatTurnover(stock.turnover)}
                        </div>
                      </div>

                      {/* Right: Price & DOWN Sign Badge */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          fontSize: '14px',
                          color: 'var(--text-main)',
                        }}>
                          ₹{stock.close_price.toFixed(2)}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--red)',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 500,
                          marginTop: '1px',
                        }}>
                          -₹{Math.abs(changeAmount).toFixed(2)}
                        </div>
                      </div>

                      {/* DOWN Sign Badge */}
                      <div className="mover-sign-badge badge-down">
                        <ArrowDownRight size={14} strokeWidth={2.5} />
                        <span>{stock.change_pct}%</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No loser data available for this session
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Turnover Leaders View */
        <div className="mover-container">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.08) 0%, transparent 100%)',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                color: 'var(--accent)',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Activity size={16} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>
                  MOST ACTIVE STOCKS BY TURNOVER
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Highest trading value in rupees (institutional liquidity)
                </div>
              </div>
            </div>
          </div>

          <div>
            {topActive.map((stock, idx) => (
              <div
                key={stock.symbol}
                className="mover-item-card"
                onClick={() => handleStockClick(stock.symbol)}
                title={`Click to open ${stock.symbol} in Stock Explorer`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '0' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'JetBrains Mono, monospace',
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                  }}>
                    #{idx + 1}
                  </div>
                  <div style={{ minWidth: '0', flex: 1 }}>
                    <div style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                      {stock.symbol}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {stock.company_name || stock.symbol}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginRight: '16px' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '13px' }}>
                    {formatTurnover(stock.turnover)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    Vol: {formatVolume(stock.volume)} shares
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '13px' }}>
                    ₹{stock.close_price.toFixed(2)}
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: stock.change_pct >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>
                    {stock.change_pct >= 0 ? `+${stock.change_pct}%` : `${stock.change_pct}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Helpful Navigation hint footer */}
      <div style={{
        marginTop: '12px',
        textAlign: 'center',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}>
        💡 Tip: Click any stock above to instantly jump to its Candlestick Chart, SMAs, Drawdown & Seasonality Analysis.
      </div>
    </div>
  );
};
