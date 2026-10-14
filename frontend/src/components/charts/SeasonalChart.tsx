import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface SeasonalChartProps {
  symbol: string;
  monthlyAverages: Record<string, number>;
  winRates?: Record<string, number>;
  periodLabel?: string;
}

declare const Plotly: any;

export const SeasonalChart: React.FC<SeasonalChartProps> = ({
  symbol,
  monthlyAverages,
  winRates,
  periodLabel = 'Monthly',
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const { chartTheme, theme } = useTheme();

  useEffect(() => {
    if (!chartRef.current || !monthlyAverages || typeof Plotly === 'undefined') return;

    const periods = Object.keys(monthlyAverages);
    const returnValues = Object.values(monthlyAverages);
    const returnColors = returnValues.map((v) => (v >= 0 ? '#16a34a' : '#dc2626'));

    const traces: any[] = [
      {
        x: periods,
        y: returnValues,
        type: 'bar',
        name: 'Avg Return %',
        marker: { color: returnColors },
        yaxis: 'y1',
        hovertemplate: '<b>%{x}</b><br>Avg Return: %{y:+.2f}%<extra></extra>',
      },
    ];

    if (winRates && Object.keys(winRates).length > 0) {
      const probValues = periods.map((p) => winRates[p] ?? null);
      traces.push({
        x: periods,
        y: probValues,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Win Probability %',
        line: { color: '#2563eb', width: 2.5 },
        marker: { size: 6, color: '#2563eb' },
        yaxis: 'y2',
        hovertemplate: '<b>%{x}</b><br>Win Probability: %{y:.1f}%<extra></extra>',
      });
    }

    const layout = {
      title: {
        text: `${symbol} Seasonal Return (%) & Historical Win Probability`,
        font: { color: chartTheme.font.color, size: 14, family: 'Inter, sans-serif' },
      },
      paper_bgcolor: chartTheme.paper_bgcolor,
      plot_bgcolor: chartTheme.plot_bgcolor,
      font: chartTheme.font,
      xaxis: {
        gridcolor: chartTheme.gridcolor,
        zerolinecolor: chartTheme.zerolinecolor,
      },
      yaxis: {
        title: { text: `Avg ${periodLabel} Return (%)`, font: { size: 12, color: chartTheme.font.color } },
        gridcolor: chartTheme.gridcolor,
        zerolinecolor: chartTheme.zerolinecolor,
        ticksuffix: '%',
      },
      yaxis2: {
        title: { text: 'Win Probability (%)', font: { size: 12, color: '#2563eb' } },
        overlaying: 'y',
        side: 'right',
        range: [0, 100],
        ticksuffix: '%',
        gridcolor: 'transparent',
      },
      legend: {
        orientation: 'h',
        y: 1.12,
        x: 0,
        font: { color: chartTheme.font.color, size: 11 },
      },
      margin: { t: 50, r: 50, l: 55, b: 35 },
      height: 380,
      hoverlabel: chartTheme.hoverlabel,
    };

    Plotly.newPlot(chartRef.current, traces, layout, { responsive: true, displaylogo: false });
  }, [symbol, monthlyAverages, winRates, chartTheme, theme, periodLabel]);

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
      <div ref={chartRef} style={{ width: '100%', height: '380px' }} />
    </div>
  );
};

