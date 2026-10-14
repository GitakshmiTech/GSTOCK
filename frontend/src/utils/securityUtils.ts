import { SecurityMasterItem } from '../types';

/**
 * Determines whether a security is an individual company equity share
 * rather than an ETF, Mutual Fund, NCD, Debenture, Bond, or Rights Entitlement (-RE).
 */
export function isShare(sec: SecurityMasterItem | null | undefined): boolean {
  if (!sec) return false;
  const isin = (sec.isin || '').trim().toUpperCase();
  const sym = (sec.symbol || '').trim().toUpperCase();
  const name = (sec.company_name || '').trim().toUpperCase();

  // 1. Exclude Rights Entitlements (symbols ending with -RE or -RE1, e.g. 3IINFO-RE, SIKKO-RE)
  if (sym.endsWith('-RE') || sym.endsWith('-RE1') || sym.endsWith('.RE') || sym.includes('-RE')) {
    return false;
  }

  // 2. Exclude Mutual Funds and ETFs (ISIN prefix INF in India)
  if (isin.startsWith('INF')) {
    return false;
  }

  // 3. For INE ISINs: check instrument type at character 8-9 (slice [7:9])
  // Under SEBI/NSDL ISIN standard:
  // - 01 = Equity Shares (fully paid up)
  // - 02 = Equity Shares (partly paid up)
  // Non-equity instruments: 07 = NCDs/Bonds, 08 = CP/Unsecured Debt, 11 = Promissory Notes, 20 = Rights Entitlement
  if (isin.startsWith('INE')) {
    const instType = isin.slice(7, 9);
    if (instType !== '01' && instType !== '02') {
      return false;
    }
  }

  // 4. IN9 ISINs are DVR (Differential Voting Rights) equity shares (e.g. TATAMTRDVR)
  if (isin.startsWith('IN9')) {
    return true;
  }

  // 5. Exclude closed-ended mutual fund schemes (Franklin Templeton, UTI US64, Birla Capital Fund)
  if (sym.startsWith('FTCSF') || sym.startsWith('FTCPOF') || sym.startsWith('UTIUS64') || sym.startsWith('BSCF')) {
    return false;
  }
  if (/\d+Y(DIV|GRO|DV|GR)/i.test(sym)) {
    return false;
  }

  // 6. Exclude ETFs / index units by symbol naming patterns
  if (sym.endsWith('ETF') || sym.endsWith('BEES') || sym.startsWith('SETF') || sym.startsWith('NETF')) {
    return false;
  }

  // 6. Exclude debt securities, debentures, NCDs, bonds, and funds by company name
  const debtAndFundKeywords = [
    'NCD',
    'DEBENTURE',
    'BOND',
    'TAX FREE',
    'SEC RE',
    'MUTUAL FUND',
    'EXCHANGE TRADED',
    'INDEX FUND',
    'GROWTH FUND',
    ' ETF',
    'ETF ',
    '- ETF',
    '(ETF',
  ];
  if (debtAndFundKeywords.some((kw) => name.includes(kw))) {
    return false;
  }

  return true;
}

/**
 * Historical stock ticker mappings for renamings and corporate mergers across NSE history.
 */
export const SYMBOL_ALIASES: Record<string, string> = {
  '3M': '3MINDIA',
  BIRLA3M: '3MINDIA',
  ICICI: 'ICICIBANK',
  UTIBANK: 'AXISBANK',
  HEROHONDA: 'HEROMOTOCO',
  ADANIEXPO: 'ADANIENT',
  CENTURYTEX: 'ABREL',
  BOOTSPHARM: 'ABBOTINDIA',
  KALECONSUL: 'ACCELYA',
  ADVANIORLI: 'ADOR',
  ADORWELD: 'ADOR',
};

/**
 * Resolves any historical ticker symbol to its active canonical ticker.
 */
export function resolveCanonicalSymbol(symbol: string): string {
  const clean = (symbol || '').trim().toUpperCase();
  return SYMBOL_ALIASES[clean] || clean;
}

/**
 * Determines whether a security is currently delisted, suspended, or inactive on NSE.
 */
export function isDelisted(sec: SecurityMasterItem | null | undefined): boolean {
  if (!sec) return false;
  if (sec.is_delisted === true) return true;
  if (sec.status === 'DELISTED' || sec.status === 'SUSPENDED' || sec.status === 'INACTIVE') return true;
  if (sec.last_traded_date) {
    const lastDate = new Date(sec.last_traded_date);
    const cutoffDate = new Date('2026-07-15');
    if (lastDate < cutoffDate) return true;
  }
  return false;
}

/**
 * Returns a human-friendly string for when a delisted stock last traded on NSE.
 */
export function getDelistedNotice(sec: SecurityMasterItem | null | undefined): string | null {
  if (!sec || !isDelisted(sec)) return null;
  if (!sec.last_traded_date) {
    return 'Delisted / Inactive on NSE';
  }
  const parts = sec.last_traded_date.split('-');
  const year = parts[0];
  const month = parts[1];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = monthNames[monthIdx] || month;
  return `Delisted • Last traded: ${monthName} ${year}`;
}

