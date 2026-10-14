import React from 'react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (val: string) => void;
  onEndChange: (val: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-main)',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      />
      <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-main)',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      />
    </div>
  );
};
