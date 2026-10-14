import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, AlertCircle, ArrowUpRight } from 'lucide-react';

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both Email ID and password.');
      return;
    }

    try {
      setError(null);
      setSubmitting(true);
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your Email ID and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-base)',
      padding: '20px',
      position: 'relative',
    }}>
      {/* Top right theme switch */}
      <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
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
      </div>

      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '36px 32px',
        boxShadow: 'var(--card-shadow)',
      }}>
        {/* Header / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '18px',
            fontFamily: 'JetBrains Mono, monospace',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
          }}>
            NSE
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
            Analytics Terminal
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Market Intelligence & Quantitative Research
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--tile-neg-bg)',
            border: '1px solid var(--tile-neg-border)',
            color: 'var(--tile-neg-color)',
            fontSize: '13px',
            marginBottom: '20px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '6px',
              fontFamily: 'Inter, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Email ID / Login ID
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}>
                <MailIcon />
              </div>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@nse.com"
                autoComplete="email"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '6px',
              fontFamily: 'Inter, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Lock size={16} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {submitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In with Email ID</span>
                <ArrowUpRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
