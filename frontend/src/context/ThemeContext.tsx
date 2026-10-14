import React from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ChartThemeColors {
  paper_bgcolor: string;
  plot_bgcolor: string;
  font: { color: string; family: string };
  gridcolor: string;
  zerolinecolor: string;
  hoverlabel: {
    bgcolor: string;
    bordercolor: string;
    font: { color: string; family: string; size: number };
  };
}

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  chartTheme: ChartThemeColors;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = React.useState<ThemeMode>(() => {
    const saved = localStorage.getItem('nse_theme') as ThemeMode;
    // Default to 'light' (clean white UI) per user requirement
    return saved === 'dark' ? 'dark' : 'light';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nse_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setTheme(mode);
  };

  const chartTheme: ChartThemeColors = {
    paper_bgcolor: theme === 'light' ? '#ffffff' : '#111827',
    plot_bgcolor: theme === 'light' ? '#ffffff' : '#111827',
    font: {
      color: theme === 'light' ? '#475569' : '#9ca3af',
      family: 'JetBrains Mono, monospace',
    },
    gridcolor: theme === 'light' ? '#f1f5f9' : '#1f2d47',
    zerolinecolor: theme === 'light' ? '#e2e8f0' : '#24344d',
    hoverlabel: {
      bgcolor: theme === 'light' ? '#ffffff' : '#1e293b',
      bordercolor: theme === 'light' ? '#cbd5e1' : '#334155',
      font: {
        color: theme === 'light' ? '#0f172a' : '#f8fafc',
        family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        size: 12,
      },
    },
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeMode, chartTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = React.useContext<ThemeContextType | undefined>(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context as ThemeContextType;
};
