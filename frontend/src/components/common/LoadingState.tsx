import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading market data...' }) => {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
      <div>{message}</div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
