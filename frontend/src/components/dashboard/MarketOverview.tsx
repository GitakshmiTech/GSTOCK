import React from 'react';
import { MarketOverviewData } from '../../types';
import { MetricCard } from './MetricCard';

interface MarketOverviewProps {
  data: MarketOverviewData;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({ data }) => {
  const totalMovers = data.advances + data.declines + data.unchanged;
  const winRate = totalMovers > 0 ? ((data.advances / totalMovers) * 100).toFixed(1) : '0';

  return (
    <div className="metrics-row">
      <MetricCard
        label="Market Breadth"
        value={
          <span style={{ fontSize: '15px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--green)' }}>{data.advances} Adv</span>
            <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>/</span>
            <span style={{ color: data.declines > data.advances ? 'var(--red)' : 'var(--text-muted)' }}>{data.declines} Dec</span>
          </span>
        }
        subtext={`${winRate}% Advancing • ${data.unchanged} Unch`}
        trend={data.advances >= data.declines ? 'up' : 'down'}
      />
      <MetricCard
        label="Gross Turnover"
        value={`₹${(data.total_turnover / 1e7).toFixed(2)} Cr`}
        subtext="Cash equity segment trading value"
      />
      <MetricCard
        label="Total Traded Volume"
        value={`${(data.total_volume / 1e6).toFixed(2)} M`}
        subtext="Traded equity shares"
      />
      <MetricCard
        label="Traded Securities"
        value={`${data.traded_securities_count.toLocaleString()}`}
        subtext={`Active out of ${data.total_securities_count.toLocaleString()} master`}
      />
      <MetricCard
        label="Total Database Records"
        value={(data.total_records_count || 0).toLocaleString()}
        subtext="Daily historical price bars"
      />
    </div>
  );
};
