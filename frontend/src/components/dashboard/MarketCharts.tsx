import React, { useEffect, useRef, useState } from 'react';
import { MarketMover } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, PieChart, Activity, LayoutGrid } from 'lucide-react';

declare const Plotly: any;

interface MarketChartsProps {
  gainers: MarketMover[];
  losers: MarketMover[];
  mostActive?: MarketMover[];
  advances: number;
  declines: number;
  unchanged: number;
  onSelectStock?: (symbol: string) => void;
}

type ChartViewMode = 'movers' | 'breadth' | 'turnover' | 'dual';

export const MarketCharts: React.FC<MarketChartsProps> = ({
  gainers,
  losers,
  mostActive = [],
  advances,
  declines,
  unchanged,
  onSelectStock,
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('movers');
  const moversChartRef = useRef<HTMLDivElement>(null);
  const breadthChartRef = useRef<HTMLDivElement>(null);
  const turnoverChartRef = useRef<HTMLDivElement>(null);
  const dualMoversRef = useRef<HTMLDivElement>(null);
  const dualBreadthRef = useRef<HTMLDivElement>(null);
  const { chartTheme } = useTheme();

  const top5Gainers = (gainers || []).slice(0, 5);
  const top5Losers = (losers || []).slice(0, 5);
  const top5Active = (mostActive || []).slice(0, 5);

  // Helper to render Movers Horizontal Bar Chart
  const renderMoversChart = (container: HTMLDivElement | null) => {
    if (!container || typeof Plotly === 'undefined') return;

    // Combine top 5 losers (bottom) to top 5 gainers (top)
    // In horizontal bar charts, Plotly renders y-axis from bottom to top, so reverse for natural ordering
    const orderedLosers = [...top5Losers].reverse();
    const orderedGainers = [...top5Gainers].reverse();

    const symbols: string[] = [];
    const returns: number[] = [];
    const colors: string[] = [];
    const hoverTexts: string[] = [];
    const textLabels: string[] = [];

    // Add losers first (will be on lower half)
    for (const l of orderedLosers) {
      symbols.push(l.symbol);
      returns.push(l.change_pct);
      colors.push('#ef4444');
      const company = l.company_name || l.symbol;
      hoverTexts.push(
        `<span style="color: #0f172a; font-weight: 700;">${l.symbol} • ${company}</span><br>` +
        `<span style="color: #475569;">Close: </span><b style="color: #0f172a;">₹${l.close_price.toFixed(2)}</b><br>` +
        `<span style="color: #475569;">Change: </span><b style="color: #dc2626;">₹${(l.change ?? (l.close_price - l.prev_close)).toFixed(2)} (${l.change_pct > 0 ? '+' : ''}${l.change_pct}%)</b><br>` +
        `<span style="color: #64748b; font-size: 11px;">Volume: ${(l.volume || 0).toLocaleString()} shares</span>`
      );
      textLabels.push(`${l.change_pct}%`);
    }

    // Add gainers
    for (const g of orderedGainers) {
      symbols.push(g.symbol);
      returns.push(g.change_pct);
      colors.push('#10b981');
      const company = g.company_name || g.symbol;
      hoverTexts.push(
        `<span style="color: #0f172a; font-weight: 700;">${g.symbol} • ${company}</span><br>` +
        `<span style="color: #475569;">Close: </span><b style="color: #0f172a;">₹${g.close_price.toFixed(2)}</b><br>` +
        `<span style="color: #475569;">Change: </span><b style="color: #16a34a;">+₹${(g.change ?? (g.close_price - g.prev_close)).toFixed(2)} (+${g.change_pct}%)</b><br>` +
        `<span style="color: #64748b; font-size: 11px;">Volume: ${(g.volume || 0).toLocaleString()} shares</span>`
      );
      textLabels.push(`+${g.change_pct}%`);
    }

    const trace = {
      type: 'bar',
      orientation: 'h',
      x: returns,
      y: symbols,
      marker: {
        color: colors,
        line: { color: colors, width: 1 },
      },
      text: textLabels,
      textposition: 'auto',
      textfont: {
        color: '#ffffff',
        family: 'JetBrains Mono, monospace',
        size: 11,
        weight: 600,
      },
      hoverinfo: 'text',
      hovertext: hoverTexts,
      hoverlabel: chartTheme.hoverlabel,
    };

    const layout = {
      title: {
        text: 'Top 5 Gainers vs Top 5 Losers Return (%)',
        font: { size: 14, color: chartTheme.font.color, family: 'Inter, sans-serif' },
        x: 0.02,
        y: 0.95,
      },
      paper_bgcolor: chartTheme.paper_bgcolor,
      plot_bgcolor: chartTheme.plot_bgcolor,
      font: chartTheme.font,
      hoverlabel: chartTheme.hoverlabel,
      autosize: true,
      height: 380,
      margin: { l: 110, r: 40, t: 50, b: 40 },
      xaxis: {
        title: { text: 'Return (%)', font: { size: 12, color: chartTheme.font.color } },
        gridcolor: chartTheme.gridcolor,
        zerolinecolor: chartTheme.zerolinecolor,
        zerolinewidth: 2,
        ticksuffix: '%',
      },
      yaxis: {
        automargin: true,
        tickfont: { family: 'JetBrains Mono, monospace', size: 12, weight: 600 },
        gridcolor: chartTheme.gridcolor,
      },
    };

    Plotly.newPlot(container, [trace], layout, { responsive: true, displaylogo: false });

    // Handle click to explore stock
    const c = container as any;
    c.removeAllListeners?.('plotly_click');
    c.on?.('plotly_click', (data: any) => {
      if (data?.points?.[0]?.y && onSelectStock) {
        onSelectStock(data.points[0].y);
      }
    });
  };

  // Helper to render Breadth Donut Chart
  const renderBreadthChart = (container: HTMLDivElement | null) => {
    if (!container || typeof Plotly === 'undefined') return;

    const total = advances + declines + unchanged;
    const advPct = total > 0 ? ((advances / total) * 100).toFixed(1) : '0';

    const trace = {
      type: 'pie',
      hole: 0.62,
      labels: ['Advances (Gainers)', 'Declines (Losers)', 'Unchanged'],
      values: [advances, declines, unchanged],
      marker: {
        colors: ['#10b981', '#ef4444', '#64748b'],
      },
      textinfo: 'label+percent',
      textposition: 'outside',
      insidetextfont: { color: '#ffffff', size: 12 },
      outsidetextfont: { color: chartTheme.font.color, family: 'Inter, sans-serif', size: 12 },
      hoverinfo: 'label+value+percent',
      hovertemplate: '<span style="color: #0f172a; font-weight: 700;">%{label}</span><br><span style="color: #475569;">Count: </span><b style="color: #0f172a;">%{value:,} stocks</b><br><span style="color: #475569;">Share: </span><b style="color: #2563eb;">%{percent}</b><extra></extra>',
      hoverlabel: chartTheme.hoverlabel,
    };

    const layout = {
      title: {
        text: `Market Breadth Distribution (Total: ${total.toLocaleString()} Equities)`,
        font: { size: 14, color: chartTheme.font.color, family: 'Inter, sans-serif' },
        x: 0.02,
        y: 0.95,
      },
      paper_bgcolor: chartTheme.paper_bgcolor,
      plot_bgcolor: chartTheme.plot_bgcolor,
      font: chartTheme.font,
      hoverlabel: chartTheme.hoverlabel,
      autosize: true,
      height: 380,
      margin: { l: 40, r: 40, t: 50, b: 40 },
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: -0.1,
        font: { size: 11, color: chartTheme.font.color },
      },
      annotations: [
        {
          font: { size: 20, color: advances >= declines ? '#10b981' : '#ef4444', family: 'JetBrains Mono, monospace', weight: 700 },
          showarrow: false,
          text: `${advPct}%`,
          x: 0.5,
          y: 0.54,
        },
        {
          font: { size: 10, color: chartTheme.font.color, family: 'Inter, sans-serif' },
          showarrow: false,
          text: 'ADVANCES',
          x: 0.5,
          y: 0.44,
        },
      ],
    };

    Plotly.newPlot(container, [trace], layout, { responsive: true, displaylogo: false });
  };

  // Helper to render Turnover Leaders Chart
  const renderTurnoverChart = (container: HTMLDivElement | null) => {
    if (!container || typeof Plotly === 'undefined' || top5Active.length === 0) return;

    const symbols = top5Active.map((s) => s.symbol).reverse();
    const turnoverCr = top5Active.map((s) => Number((s.turnover / 1e7).toFixed(2))).reverse();
    const hoverTexts = top5Active.map((s) => {
      const comp = s.company_name || s.symbol;
      return (
        `<span style="color: #0f172a; font-weight: 700;">${s.symbol} • ${comp}</span><br>` +
        `<span style="color: #475569;">Turnover: </span><b style="color: #d97706;">₹${(s.turnover / 1e7).toFixed(2)} Cr</b><br>` +
        `<span style="color: #475569;">Close: </span><b style="color: #0f172a;">₹${s.close_price.toFixed(2)}</b> <span style="color: ${s.change_pct >= 0 ? '#16a34a' : '#dc2626'}; font-weight: 600;">(${s.change_pct > 0 ? '+' : ''}${s.change_pct}%)</span><br>` +
        `<span style="color: #64748b; font-size: 11px;">Volume: ${(s.volume || 0).toLocaleString()} shares</span>`
      );
    }).reverse();

    const trace = {
      type: 'bar',
      orientation: 'h',
      x: turnoverCr,
      y: symbols,
      marker: {
        color: '#2563eb',
        opacity: 0.85,
        line: { color: '#1d4ed8', width: 1 },
      },
      text: turnoverCr.map((v) => `₹${v} Cr`),
      textposition: 'auto',
      textfont: {
        color: '#ffffff',
        family: 'JetBrains Mono, monospace',
        size: 11,
        weight: 600,
      },
      hoverinfo: 'text',
      hovertext: hoverTexts,
      hoverlabel: chartTheme.hoverlabel,
    };

    const layout = {
      title: {
        text: 'Top 5 Most Active Stocks by Turnover (₹ Crores)',
        font: { size: 14, color: chartTheme.font.color, family: 'Inter, sans-serif' },
        x: 0.02,
        y: 0.95,
      },
      paper_bgcolor: chartTheme.paper_bgcolor,
      plot_bgcolor: chartTheme.plot_bgcolor,
      font: chartTheme.font,
      hoverlabel: chartTheme.hoverlabel,
      autosize: true,
      height: 380,
      margin: { l: 110, r: 40, t: 50, b: 40 },
      xaxis: {
        title: { text: 'Turnover (₹ Crores)', font: { size: 12, color: chartTheme.font.color } },
        gridcolor: chartTheme.gridcolor,
        zerolinecolor: chartTheme.zerolinecolor,
      },
      yaxis: {
        automargin: true,
        tickfont: { family: 'JetBrains Mono, monospace', size: 12, weight: 600 },
        gridcolor: chartTheme.gridcolor,
      },
    };

    Plotly.newPlot(container, [trace], layout, { responsive: true, displaylogo: false });

    const c = container as any;
    c.removeAllListeners?.('plotly_click');
    c.on?.('plotly_click', (data: any) => {
      if (data?.points?.[0]?.y && onSelectStock) {
        onSelectStock(data.points[0].y);
      }
    });
  };

  // Re-render when view mode or theme changes
  useEffect(() => {
    if (viewMode === 'movers') {
      renderMoversChart(moversChartRef.current);
    } else if (viewMode === 'breadth') {
      renderBreadthChart(breadthChartRef.current);
    } else if (viewMode === 'turnover') {
      renderTurnoverChart(turnoverChartRef.current);
    } else if (viewMode === 'dual') {
      renderMoversChart(dualMoversRef.current);
      renderBreadthChart(dualBreadthRef.current);
    }
  }, [viewMode, gainers, losers, mostActive, advances, declines, unchanged, chartTheme]);

  return (
    <div className="chart-card-container">
      {/* Header and View Selector Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--accent)" />
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
            Market Intelligence Visualizations
          </h3>
          <span style={{
            fontSize: '11px',
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Interactive Charts
          </span>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setViewMode('movers')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: viewMode === 'movers' ? '1px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: viewMode === 'movers' ? 'var(--nav-active-bg)' : 'transparent',
              color: viewMode === 'movers' ? 'var(--accent)' : 'var(--text-main)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart3 size={14} />
            Top Movers Returns
          </button>

          <button
            onClick={() => setViewMode('breadth')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: viewMode === 'breadth' ? '1px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: viewMode === 'breadth' ? 'var(--nav-active-bg)' : 'transparent',
              color: viewMode === 'breadth' ? 'var(--accent)' : 'var(--text-main)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <PieChart size={14} />
            Market Breadth Donut
          </button>

          {top5Active.length > 0 && (
            <button
              onClick={() => setViewMode('turnover')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: viewMode === 'turnover' ? '1px solid var(--accent)' : '1px solid var(--border)',
                backgroundColor: viewMode === 'turnover' ? 'var(--nav-active-bg)' : 'transparent',
                color: viewMode === 'turnover' ? 'var(--accent)' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Activity size={14} />
              Turnover Leaders
            </button>
          )}

          <button
            onClick={() => setViewMode('dual')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: viewMode === 'dual' ? '1px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: viewMode === 'dual' ? 'var(--nav-active-bg)' : 'transparent',
              color: viewMode === 'dual' ? 'var(--accent)' : 'var(--text-main)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <LayoutGrid size={14} />
            Dual View
          </button>
        </div>
      </div>

      {/* Single View or Dual Grid */}
      {viewMode === 'movers' && (
        <div ref={moversChartRef} style={{ width: '100%', minHeight: '380px' }} />
      )}

      {viewMode === 'breadth' && (
        <div ref={breadthChartRef} style={{ width: '100%', minHeight: '380px' }} />
      )}

      {viewMode === 'turnover' && (
        <div ref={turnoverChartRef} style={{ width: '100%', minHeight: '380px' }} />
      )}

      {viewMode === 'dual' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          <div ref={dualMoversRef} style={{ width: '100%', minHeight: '380px' }} />
          <div ref={dualBreadthRef} style={{ width: '100%', minHeight: '380px' }} />
        </div>
      )}

      <div style={{
        marginTop: '10px',
        fontSize: '11px',
        color: 'var(--text-dim)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <span>💡 Click any bar on the chart to inspect that stock directly in Stock Explorer.</span>
        <span>Advance Ratio: <b>{advances}</b> Adv vs <b>{declines}</b> Dec ({((advances / (advances + declines + unchanged || 1)) * 100).toFixed(1)}%)</span>
      </div>
    </div>
  );
};
