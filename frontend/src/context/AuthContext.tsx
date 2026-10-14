import React from 'react';
import { AuthUser } from '../types';
import { fetchCurrentUser, loginUser, logoutUser } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasAccess: (screenKey: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = React.useState<string | null>(() => {
    return localStorage.getItem('nse_auth_token');
  });

  const [user, setUser] = React.useState<AuthUser | null>(() => {
    const cached = localStorage.getItem('nse_user_profile');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = React.useState<boolean>(true);

  const refreshUser = React.useCallback(async () => {
    const savedToken = localStorage.getItem('nse_auth_token');
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await fetchCurrentUser();
      setUser(profile);
      localStorage.setItem('nse_user_profile', JSON.stringify(profile));
    } catch (err) {
      console.warn('Session verification failed, logging out:', err);
      localStorage.removeItem('nse_auth_token');
      localStorage.removeItem('nse_user_profile');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    const result = await loginUser(username, password);
    localStorage.setItem('nse_auth_token', result.token);
    localStorage.setItem('nse_user_profile', JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
  };

  const logout = async () => {
    await logoutUser();
    setToken(null);
    setUser(null);
  };

  const hasAccess = (screenKey: string): boolean => {
    if (!user) return false;
    // Admins have access to everything
    if (user.role === 'admin') return true;
    // User management is strictly admin only
    if (screenKey === 'users') return false;
    // Otherwise check screen permissions list
    return Array.isArray(user.accessible_screens) && user.accessible_screens.includes(screenKey);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        hasAccess,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext<AuthContextType | undefined>(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context as AuthContextType;
};
