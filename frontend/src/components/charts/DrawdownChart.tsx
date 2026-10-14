import React, { useEffect, useRef } from 'react';
import { StockPriceRecord } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface DrawdownChartProps {
  data: StockPriceRecord[];
}

declare const Plotly: any;

export const DrawdownChart: React.FC<DrawdownChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const { chartTheme } = useTheme();

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0 || typeof Plotly === 'undefined') return;

    const dates = data.map((d) => d.trade_date);
    const drawdowns = data.map((d) => d.drawdown ?? 0);

    const trace = {
      x: dates,
      y: drawdowns,
      type: 'scatter',
      fill: 'tozeroy',
      name: 'Drawdown',
      fillcolor: 'rgba(220, 38, 38, 0.15)',
      line: { color: '#dc2626', width: 1.5 },
      hovertemplate: '<b>%{x}</b><br>Drawdown: %{y:.2f}%<extra></extra>',
    };

    const layout = {
      title: {
        text: 'Historical Underwater / Drawdown Profile (%)',
        font: { color: chartTheme.font.color, size: 13, family: 'Inter, sans-serif' },
      },
      paper_bgcolor: chartTheme.paper_bgcolor,
      plot_bgcolor: chartTheme.plot_bgcolor,
      font: chartTheme.font,
      xaxis: { gridcolor: chartTheme.gridcolor, zerolinecolor: chartTheme.zerolinecolor },
      yaxis: { gridcolor: chartTheme.gridcolor, zerolinecolor: chartTheme.zerolinecolor, ticksuffix: '%' },
      margin: { t: 30, r: 20, l: 50, b: 30 },
      height: 240,
      hoverlabel: chartTheme.hoverlabel,
    };

    Plotly.newPlot(chartRef.current, [trace], layout, { responsive: true, displaylogo: false });
  }, [data, chartTheme]);

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
      <div ref={chartRef} style={{ width: '100%', height: '240px' }} />
    </div>
  );
};

