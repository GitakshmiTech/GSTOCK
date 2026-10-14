/* Comprehensive ambient declarations for IDE TypeScript resolution */

declare module 'react' {
  export interface CSSProperties {
    [key: string]: any;
  }

  export type ReactNode = any;
  export type FC<P = {}> = (props: P) => any;

  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initialValue?: T): { current: T };
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: any[]): T;
  export function createContext<T>(defaultValue: T): any;
  export function useContext<T>(context: any): T;

  export interface FormEvent<T = Element> {
    preventDefault(): void;
    stopPropagation(): void;
    target: T;
  }

  export interface ChangeEvent<T = Element> {
    target: T & { value: string };
  }

  export const StrictMode: FC<{ children?: ReactNode }>;

  const React: {
    FC: typeof FC;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
    useMemo: typeof useMemo;
    useCallback: typeof useCallback;
    createContext: typeof createContext;
    useContext: typeof useContext;
    StrictMode: typeof StrictMode;
    createElement: any;
  };

  export default React;
}

declare module 'react-dom/client' {
  export interface Root {
    render(children: any): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;

  const ReactDOM: {
    createRoot: typeof createRoot;
  };
  export default ReactDOM;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'lucide-react' {
  export interface LucideProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    className?: string;
    style?: any;
    [key: string]: any;
  }

  export type LucideIcon = (props: LucideProps) => any;

  export const BarChart3: LucideIcon;
  export const LineChart: LucideIcon;
  export const Calendar: LucideIcon;
  export const Scale: LucideIcon;
  export const Database: LucideIcon;
  export const Settings: LucideIcon;
  export const Search: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const ArrowDownRight: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const Clock: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const FileText: LucideIcon;
  export const Sliders: LucideIcon;
  export const Download: LucideIcon;
  export const Upload: LucideIcon;
  export const Users: LucideIcon;
  export const User: LucideIcon;
  export const UserPlus: LucideIcon;
  export const Shield: LucideIcon;
  export const Lock: LucideIcon;
  export const LogOut: LucideIcon;
  export const Key: LucideIcon;
  export const Trash2: LucideIcon;
  export const Edit2: LucideIcon;
  export const Check: LucideIcon;
  export const X: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const CandlestickChart: LucideIcon;
  export const ArrowUpDown: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const Minus: LucideIcon;
  export const Filter: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronsLeft: LucideIcon;
  export const ChevronsRight: LucideIcon;
  export const CalendarDays: LucideIcon;
  export const Table2: LucideIcon;
  export const Table: LucideIcon;
  export const Activity: LucideIcon;
  export const PieChart: LucideIcon;
  export const LayoutGrid: LucideIcon;
  export const LayoutList: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const BarChart2: LucideIcon;
  export const Copy: LucideIcon;
}

declare module 'plotly.js-dist-min' {
  const Plotly: any;
  export default Plotly;
}

declare module 'vite' {
  export function defineConfig(config: any): any;
}

declare module '@vitejs/plugin-react' {
  export default function react(options?: any): any;
}

declare const Plotly: any;

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
