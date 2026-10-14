import React from 'react';

export const Settings: React.FC = () => {
  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Platform Settings & Diagnostics</h2>

      <div style={{ maxWidth: '640px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            FastAPI Backend Endpoint
          </label>
          <input
            type="text"
            readOnly
            value="http://localhost:8000"
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              padding: '8px 12px',
              borderRadius: '6px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Scheduled Trigger Time
          </label>
          <input
            type="text"
            readOnly
            value="16:00:00 Asia/Kolkata (Daily)"
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              padding: '8px 12px',
              borderRadius: '6px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Active Database Engine
          </label>
          <input
            type="text"
            readOnly
            value="MySQL 8.0+ (PyMySQL / SQLAlchemy 2.0 Pool)"
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              padding: '8px 12px',
              borderRadius: '6px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Archive Formats Supported
          </label>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            • Legacy Capital Market Bhavcopy (pre-July 8, 2024)<br />
            • Modern UDiFF Common Bhavcopy Final ZIP (July 8, 2024 onwards)<br />
            • Standalone CSV and GZIP files
          </div>
        </div>
      </div>
    </div>
  );
};
