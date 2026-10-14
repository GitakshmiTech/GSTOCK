import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface StockSearchProps {
  onSelectSymbol: (symbol: string) => void;
  initialValue?: string;
}

export const StockSearch: React.FC<StockSearchProps> = ({ onSelectSymbol, initialValue = '' }) => {
  const [query, setQuery] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSelectSymbol(query.trim().toUpperCase());
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-dim)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Symbol or stock..."
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-main)',
            padding: '7px 12px 7px 32px',
            borderRadius: '6px',
            fontSize: '13px',
            textTransform: 'uppercase',
            fontFamily: 'JetBrains Mono, monospace',
            width: '220px',
          }}
        />
      </div>
      <button type="submit" className="btn-primary" style={{ padding: '7px 14px' }}>
        Load
      </button>
    </form>
  );
};
