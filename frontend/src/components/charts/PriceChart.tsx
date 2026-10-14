import React, { useEffect, useRef } from 'react';
import { StockPriceRecord } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface PriceChartProps {
  symbol: string;
  data: StockPriceRecord[];
}

declare const Plotly: any;

export const PriceChart: React.FC<PriceChartProps> = ({ symbol, data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const { chartTheme } = useTheme();

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0 || typeof Plotly === 'undefined') return;

    const dates = data.map((d) => d.trade_date);
    const opens = data.map((d) => d.open);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const closes = data.map((d) => d.close);
    const sma20 = data.map((d) => d.sma_20);
    const sma50 = data.map((d) => d.sma_50);

    const traceCandle = {
      x: dates,
      open: opens,
      high: highs,
      low: lows,
      close: closes,
      type: 'candlestick',
      name: symbol,
      increasing: { line: { color: '#16a34a' } },
      decreasing: { line: { color: '#dc2626' } },
    };

    const traceSMA20 = {
      x: dates,
      y: sma20,
      type: 'scatter',
      mode: 'lines',
      name: 'SMA 20',
      line: { color: '#f59e0b', width: 1.5 },
    };

    const traceSMA50 = {
      x: dates,
      y: sma50,
      type: 'scatter',
      mode: 'lines',
      name: 'SMA 50',
      line: { color: '#2563eb', width: 1.5 },
    };

    const layout = {
      title: {
        text: `${symbol} OHLC Price Action & Moving Averages`,
        font: { color: chartTheme.font.color, size: 14, family: 'Inter, sans-serif' },
      },
      paper_bgcolor: chartTheme.paper_bgcolor,
      plot_bgcolor: chartTheme.plot_bgcolor,
      font: chartTheme.font,
      xaxis: {
        rangeslider: { visible: false },
        gridcolor: chartTheme.gridcolor,
        zerolinecolor: chartTheme.zerolinecolor,
      },
      yaxis: {
        gridcolor: chartTheme.gridcolor,
        zerolinecolor: chartTheme.zerolinecolor,
      },
      margin: { t: 40, r: 20, l: 50, b: 30 },
      height: 480,
      hoverlabel: chartTheme.hoverlabel,
    };

    Plotly.newPlot(chartRef.current, [traceCandle, traceSMA20, traceSMA50], layout, { responsive: true, displaylogo: false });
  }, [symbol, data, chartTheme]);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
        boxShadow: 'var(--card-shadow)',
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >
      <div ref={chartRef} style={{ width: '100%', height: '480px' }} />
    </div>
  );
};

