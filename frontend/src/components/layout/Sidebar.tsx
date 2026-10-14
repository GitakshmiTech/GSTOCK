import React from 'react';
import { BarChart3, CandlestickChart, LineChart, Calendar, Scale, Database, Settings, Users, Shield, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onRouteChange }) => {
  const { user, hasAccess } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Main Dashboard', icon: BarChart3 },
    { id: 'daily-ohlc', label: 'All Stocks OHLC', icon: CandlestickChart },
    { id: 'explorer', label: 'Stock Explorer', icon: LineChart },
    { id: 'seasonality', label: 'Seasonal Analysis', icon: Calendar },
    { id: 'comparison', label: 'Stock Comparison', icon: Scale },
    { id: 'data-mgmt', label: 'Data Management', icon: Database },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Dynamic permission filter: Only display screens the user has access to
  const visibleNavItems = navItems.filter((item) => hasAccess(item.id));

  return (
    <aside className="terminal-sidebar">
      <div className="terminal-brand">
        <div className="brand-badge">NSE</div>
        <div>
          <div className="brand-title">ANALYTICS TERMINAL</div>
          <div className="brand-sub">MARKET INTELLIGENCE</div>
        </div>
      </div>

      <ul className="nav-list">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;
          return (
            <li
              key={item.id}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => onRouteChange(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: 'var(--text-muted)' }}>
          {user?.role === 'admin' ? <Shield size={12} color="var(--accent)" /> : <Key size={12} color="var(--green)" />}
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{user?.username.toUpperCase()}</span>
          <span>({user?.role.toUpperCase()})</span>
        </div>
        <div>SCHEDULE: 16:00 IST</div>
        <div style={{ marginTop: '4px' }}>PERMISSIONS: {user?.role === 'admin' ? 'FULL ACCESS' : `${user?.accessible_screens.length || 0} SCREEN(S)`}</div>
      </div>
    </aside>
  );
};
