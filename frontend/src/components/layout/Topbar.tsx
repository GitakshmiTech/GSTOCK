import React from 'react';
import { RefreshCw, User as UserIcon, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  latestDate: string | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export const Topbar: React.FC<TopbarProps> = ({ latestDate, onRefresh, isRefreshing = false }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header className="terminal-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          color: 'var(--green)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace'
        }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: 'var(--green)',
            boxShadow: '0 0 8px var(--green)'
          }} />
          <span>EOD FEED: ACTIVE</span>
        </div>

        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {latestDate ? `LATEST TRADED DATE: ${latestDate}` : 'CHECKING TRADING DATES...'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* User Profile Badge */}
        {user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '12px',
          }}>
            <UserIcon size={14} color="var(--accent)" />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{user.email || user.username}</span>
            <span style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: user.role === 'admin' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(22, 163, 74, 0.12)',
              color: user.role === 'admin' ? 'var(--accent)' : 'var(--green)',
              fontWeight: 700,
              textTransform: 'uppercase',
              fontFamily: 'JetBrains Mono',
            }}>
              {user.role}
            </span>
          </div>
        )}

        {/* Light / Dark Mode Toggle */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <>
              <MoonIcon />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <SunIcon />
              <span>Light Mode</span>
            </>
          )}
        </button>

        <button className="btn-secondary" onClick={onRefresh} disabled={isRefreshing} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          <span>Refresh</span>
        </button>

        {/* Logout Button */}
        {user && (
          <button
            className="btn-secondary"
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}
            title="Sign out of active session"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};
