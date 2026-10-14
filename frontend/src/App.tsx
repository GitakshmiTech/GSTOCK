import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { PageContainer } from './components/layout/PageContainer';
import { Dashboard } from './routes/Dashboard';
import { DailyOHLC } from './routes/DailyOHLC';
import { StockExplorer } from './routes/StockExplorer';
import { SeasonalAnalysis } from './routes/SeasonalAnalysis';
import { MarketComparison } from './routes/MarketComparison';
import { DataManagement } from './routes/DataManagement';
import { UserManagement } from './routes/UserManagement';
import { Settings } from './routes/Settings';
import { Login } from './routes/Login';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShieldAlert } from 'lucide-react';
import './styles/terminal.css';

const AppContent: React.FC = () => {
  const { user, loading, hasAccess } = useAuth();
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  // If user does not have access to current route, redirect to their first permitted screen
  useEffect(() => {
    if (!user) return;
    if (!hasAccess(currentRoute)) {
      if (user.role === 'admin') {
        setCurrentRoute('dashboard');
      } else if (user.accessible_screens && user.accessible_screens.length > 0) {
        setCurrentRoute(user.accessible_screens[0]);
      }
    }
  }, [user, currentRoute, hasAccess]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-main)',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '16px',
        }} />
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          INITIALIZING NSE TERMINAL AUTHENTICATION...
        </div>
      </div>
    );
  }

  // If not logged in, show Login Screen
  if (!user) {
    return <Login />;
  }

  const renderRoute = () => {
    // Screen access permission gate
    if (!hasAccess(currentRoute)) {
      return (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          marginTop: '40px',
        }}>
          <ShieldAlert size={48} color="var(--red)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 20px auto' }}>
            Your account ({user.username}) does not have permissions to access the requested screen. Contact a platform administrator to update your access.
          </p>
          {user.accessible_screens && user.accessible_screens.length > 0 && (
            <button
              className="btn-primary"
              onClick={() => setCurrentRoute(user.accessible_screens[0])}
            >
              Go to Assigned Screen ({user.accessible_screens[0]})
            </button>
          )}
        </div>
      );
    }

    switch (currentRoute) {
      case 'dashboard':
        return <Dashboard key={refreshKey} onNavigate={setCurrentRoute} />;
      case 'daily-ohlc':
        return <DailyOHLC key={refreshKey} onNavigate={setCurrentRoute} />;
      case 'explorer':
        return <StockExplorer key={refreshKey} />;
      case 'seasonality':
        return <SeasonalAnalysis key={refreshKey} />;
      case 'comparison':
        return <MarketComparison key={refreshKey} />;
      case 'data-mgmt':
        return <DataManagement key={refreshKey} />;
      case 'users':
        return <UserManagement key={refreshKey} />;
      case 'settings':
        return <Settings key={refreshKey} />;
      default:
        return <Dashboard key={refreshKey} />;
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentRoute={currentRoute} onRouteChange={setCurrentRoute} />
      <main className="terminal-main">
        <Topbar latestDate="LIVE DB" onRefresh={handleRefresh} />
        <PageContainer>{renderRoute()}</PageContainer>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
