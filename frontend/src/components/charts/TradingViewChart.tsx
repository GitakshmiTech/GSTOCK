import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import { StockPriceRecord } from '../../types';
import '../../styles/tradingview.css';

interface TradingViewChartProps {
  symbol: string;
  data: StockPriceRecord[];
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol, data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [activeTool, setActiveTool] = useState<string>('crosshair');
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showSMA, setShowSMA] = useState<boolean>(true);
  const [showRiskReward, setShowRiskReward] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [activeInterval, setActiveInterval] = useState<string>('1D');
  const [pnlValue, setPnlValue] = useState<number>(-165.0);

  // Latest candle values
  const latestRecord = data && data.length > 0 ? data[data.length - 1] : null;
  const prevRecord = data && data.length > 1 ? data[data.length - 2] : null;

  const currentPrice = latestRecord?.close ?? 25445.0;
  const prevPrice = latestRecord?.prev_close ?? prevRecord?.close ?? currentPrice;
  const priceChange = currentPrice - prevPrice;
  const priceChangePct = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0.0;

  // Stop loss and target calculations for Risk:Reward demo
  const entryPrice = currentPrice;
  const stopLossPrice = Math.round(entryPrice * 1.006 * 100) / 100; // slightly above for short / below for long
  const targetPrice = Math.round(entryPrice * 0.985 * 100) / 100;

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const bgTheme = isDarkMode ? '#131722' : '#ffffff';
    const gridTheme = isDarkMode ? '#1e222d' : '#f0f3fa';
    const textTheme = isDarkMode ? '#9ca3af' : '#787b86';
    const borderTheme = isDarkMode ? '#2a2e39' : '#e0e3eb';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,
      layout: {
        background: { type: ColorType.Solid, color: bgTheme },
        textColor: textTheme,
      },
      grid: {
        vertLines: { color: gridTheme },
        horzLines: { color: gridTheme },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: borderTheme,
        visible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: borderTheme,
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    // 1. Candlestick Series (TradingView colors)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: true,
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
    });

    // Format & sort data for lightweight-charts
    const sortedData = [...data]
      .filter((d) => d.trade_date && d.open !== null && d.close !== null)
      .sort((a, b) => a.trade_date.localeCompare(b.trade_date));

    // Deduplicate by trade_date
    const seenDates = new Set<string>();
    const candleData = [];
    const volumeData = [];
    const sma20Data = [];
    const sma50Data = [];

    for (const d of sortedData) {
      if (seenDates.has(d.trade_date)) continue;
      seenDates.add(d.trade_date);

      const openVal = Number(d.open ?? d.close);
      const closeVal = Number(d.close);
      const highVal = Number(d.high ?? Math.max(openVal, closeVal));
      const lowVal = Number(d.low ?? Math.min(openVal, closeVal));

      candleData.push({
        time: d.trade_date,
        open: openVal,
        high: highVal,
        low: lowVal,
        close: closeVal,
      });

      if (d.volume) {
        volumeData.push({
          time: d.trade_date,
          value: Number(d.volume),
          color: closeVal >= openVal ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)',
        });
      }

      if (d.sma_20) {
        sma20Data.push({ time: d.trade_date, value: Number(d.sma_20) });
      }
      if (d.sma_50) {
        sma50Data.push({ time: d.trade_date, value: Number(d.sma_50) });
      }
    }

    candleSeries.setData(candleData as any);

    // 2. Volume Series (Histogram)
    if (showVolume && volumeData.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
      volumeSeries.setData(volumeData as any);
    }

    // 3. Technical Indicators (SMA Lines)
    if (showSMA) {
      if (sma20Data.length > 0) {
        const sma20Series = chart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          title: 'SMA 20',
        });
        sma20Series.setData(sma20Data as any);
      }

      if (sma50Data.length > 0) {
        const sma50Series = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          title: 'SMA 50',
        });
        sma50Series.setData(sma50Data as any);
      }
    }

    // 4. Risk / Reward Price Badges on Scale
    if (showRiskReward && candleData.length > 0) {
      candleSeries.createPriceLine({
        price: stopLossPrice,
        color: '#f23645',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'SL: ' + stopLossPrice.toFixed(2),
      });

      candleSeries.createPriceLine({
        price: entryPrice,
        color: '#787b86',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'Entry: ' + entryPrice.toFixed(2),
      });

      candleSeries.createPriceLine({
        price: targetPrice,
        color: '#089981',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'TP: ' + targetPrice.toFixed(2),
      });
    }

    chart.timeScale().fitContent();

    // Resize handler
    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, isDarkMode, showVolume, showSMA, showRiskReward, activeInterval]);

  const setRange = (type: string) => {
    if (!chartRef.current || !data || data.length === 0) return;
    const sorted = [...data].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
    const total = sorted.length;
    let fromIdx = 0;

    if (type === '1D') fromIdx = Math.max(0, total - 2);
    else if (type === '5D') fromIdx = Math.max(0, total - 5);
    else if (type === '1M') fromIdx = Math.max(0, total - 22);
    else if (type === '3M') fromIdx = Math.max(0, total - 66);
    else if (type === '6M') fromIdx = Math.max(0, total - 132);
    else if (type === '1Y') fromIdx = Math.max(0, total - 252);
    else fromIdx = 0;

    chartRef.current.timeScale().setVisibleRange({
      from: sorted[fromIdx].trade_date as any,
      to: sorted[total - 1].trade_date as any,
    });
  };

  const handleOrder = (side: 'BUY' | 'SELL') => {
    const qty = 50;
    const totalVal = (currentPrice * qty).toFixed(2);
    alert(
      `ORDER PLACED (PAPER DEMO):\nSide: ${side}\nSymbol: ${symbol}\nQuantity: ${qty} shares\nPrice: ₹${currentPrice.toFixed(2)}\nOrder Value: ₹${totalVal}\nExchange: NSE`
    );
    setPnlValue((prev) => (side === 'BUY' ? prev + 120.0 : prev - 120.0));
  };

  return (
    <div className={`tv-chart-wrapper ${isDarkMode ? 'tv-dark' : ''}`}>
      {/* 1. TOP HEADER */}
      <div className="tv-header">
        <div className="tv-header-left">
          <div className="tv-symbol-badge" title="Symbol Information">
            <span>{symbol} · {activeInterval} · NSE</span>
            <span style={{ fontSize: '11px', opacity: 0.6 }}>•••</span>
          </div>

          <div className={`tv-price-tag ${priceChange >= 0 ? 'up' : 'down'}`}>
            ₹{currentPrice.toFixed(2)}{' '}
            <span>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} (
              {priceChange >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
            </span>
          </div>

          <div className="tv-timeframe-pills">
            {['1D', '1W', '1M'].map((tf) => (
              <button
                key={tf}
                className={`tv-tf-btn ${activeInterval === tf ? 'active' : ''}`}
                onClick={() => setActiveInterval(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="tv-header-right">
          <button
            className={`tv-btn-pill ${showVolume ? 'active' : ''}`}
            onClick={() => setShowVolume(!showVolume)}
            title="Toggle Volume Subplot"
          >
            📊 Volume
          </button>

          <button
            className={`tv-btn-pill ${showSMA ? 'active' : ''}`}
            onClick={() => setShowSMA(!showSMA)}
            title="Toggle SMA 20 and SMA 50"
          >
            📈 SMA 20/50
          </button>

          <button
            className={`tv-btn-pill ${showRiskReward ? 'active' : ''}`}
            onClick={() => setShowRiskReward(!showRiskReward)}
            title="Toggle TradingView Risk:Reward Position Tool"
            style={{ backgroundColor: showRiskReward ? '#2962ff' : undefined, color: showRiskReward ? '#fff' : undefined }}
          >
            🎯 Risk:Reward
          </button>

          <button
            className="tv-btn-pill"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle Light/Dark Theme"
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      {/* 2. BODY LAYOUT (Left Toolbar + Chart Canvas + Risk:Reward overlay) */}
      <div className="tv-body">
        {/* Left Vertical Tool Dock (Exact TradingView Icons) */}
        <div className="tv-toolbar-left">
          <button
            className={`tv-tool-btn ${activeTool === 'crosshair' ? 'active' : ''}`}
            onClick={() => setActiveTool('crosshair')}
            title="Crosshair Tool"
          >
            ✛
          </button>
          <button
            className={`tv-tool-btn ${activeTool === 'trendline' ? 'active' : ''}`}
            onClick={() => setActiveTool('trendline')}
            title="Trendline Tool"
          >
            ╱
          </button>
          <button
            className={`tv-tool-btn ${activeTool === 'pitchfork' ? 'active' : ''}`}
            onClick={() => setActiveTool('pitchfork')}
            title="Pitchfork / Fibonacci"
          >
            ⌁
          </button>
          <button
            className={`tv-tool-btn ${activeTool === 'brush' ? 'active' : ''}`}
            onClick={() => setActiveTool('brush')}
            title="Geometric Brush"
          >
            🖌
          </button>
          <button
            className={`tv-tool-btn ${activeTool === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTool('text')}
            title="Text Tool"
          >
            T
          </button>
          <button
            className={`tv-tool-btn ${activeTool === 'icons' ? 'active' : ''}`}
            onClick={() => setActiveTool('icons')}
            title="Smileys & Icons"
          >
            ☺
          </button>
          <div className="tv-tool-divider" />
          <button
            className={`tv-tool-btn ${activeTool === 'ruler' ? 'active' : ''}`}
            onClick={() => setActiveTool('ruler')}
            title="Ruler Measure Tool"
          >
            📐
          </button>
          <button
            className="tv-tool-btn"
            onClick={() => chartRef.current?.timeScale().fitContent()}
            title="Reset Zoom"
          >
            🔍
          </button>
          <button
            className={`tv-tool-btn ${activeTool === 'magnet' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'magnet' ? '' : 'magnet')}
            title="Magnet Mode"
          >
            🧲
          </button>
          <button
            className={`tv-tool-btn ${activeTool === 'lock' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'lock' ? '' : 'lock')}
            title="Lock All Drawings"
          >
            🔒
          </button>
          <button
            className="tv-tool-btn"
            onClick={() => setShowRiskReward(!showRiskReward)}
            title="Hide / Show Overlays"
          >
            👁
          </button>
          <button
            className="tv-tool-btn"
            onClick={() => {
              setShowRiskReward(false);
              setShowSMA(false);
            }}
            title="Remove All Drawings"
          >
            🗑
          </button>
        </div>

        {/* Main Canvas Viewport */}
        <div className="tv-chart-viewport" ref={chartContainerRef}>
          {/* Risk:Reward Shaded Zones (Matching screenshot) */}
          {showRiskReward && (
            <div className="tv-risk-reward-overlay">
              <div className="tv-risk-box">
                <span>STOP: ₹{stopLossPrice.toFixed(2)}</span>
                <span className="tv-rr-handle" />
                <span>+0.60%</span>
              </div>
              <div className="tv-reward-box">
                <span>TARGET: ₹{targetPrice.toFixed(2)}</span>
                <span className="tv-rr-handle" />
                <span>-1.50%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM CONTROL BAR (Time Intervals & Scale Status) */}
      <div className="tv-bottom-bar">
        <div className="tv-range-buttons">
          <span>Date Range:</span>
          {['1D', '5D', '1M', '3M', '6M', '1Y', 'All'].map((rng) => (
            <button key={rng} className="tv-range-btn" onClick={() => setRange(rng)}>
              {rng}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>{new Date().toLocaleTimeString('en-IN')} IST</span>

          <div className="tv-scale-toggles">
            <span className="tv-scale-toggle" title="Percentage scale">
              %
            </span>
            <span className="tv-scale-toggle" title="Logarithmic scale">
              log
            </span>
            <span className="tv-scale-toggle active" title="Auto fit scale">
              auto
            </span>
            <span className="tv-scale-toggle" title="Chart Settings">
              ⚙
            </span>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM TRADING ACTION DOCK (Zerodha / Groww matching screenshot) */}
      <div className="tv-trading-dock">
        <div className="tv-dock-pnl">
          <span style={{ color: pnlValue >= 0 ? '#089981' : '#f23645' }}>●</span>
          <span>Total P&L:</span>
          <span style={{ color: pnlValue >= 0 ? '#089981' : '#f23645', fontFamily: 'JetBrains Mono' }}>
            {pnlValue >= 0 ? '+' : ''}₹{pnlValue.toFixed(2)}
          </span>
          <span style={{ cursor: 'pointer', fontSize: '11px', opacity: 0.7 }}>⌃</span>
        </div>

        <div className="tv-dock-links">
          <span className="tv-dock-link" onClick={() => alert(`Exploring option chain & depth for ${symbol}`)}>
            🧭 Explore
          </span>
          <span className="tv-dock-link" onClick={() => alert(`Loading Option Chain for ${symbol}`)}>
            🔗 Option Chain
          </span>
          <span className="tv-dock-link" onClick={() => alert(`View active order book & trades`)}>
            📋 Orders
          </span>
        </div>

        <div className="tv-dock-actions">
          <button className="tv-buy-btn" onClick={() => handleOrder('BUY')}>
            BUY
          </button>
          <button className="tv-sell-btn" onClick={() => handleOrder('SELL')}>
            SELL
          </button>
        </div>
      </div>
    </div>
  );
};
