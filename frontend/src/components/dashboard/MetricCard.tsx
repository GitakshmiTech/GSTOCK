import React from 'react';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtext, trend }) => {
  return (
    <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="metric-label">{label}</div>
      <div
        className={`metric-val ${trend === 'up' ? 'text-gainer' : trend === 'down' ? 'text-loser' : ''}`}
        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {value}
      </div>
      {subtext && (
        <div
          className="metric-sub"
          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          title={typeof subtext === 'string' ? subtext : undefined}
        >
          {subtext}
        </div>
      )}
    </div>
  );
};
