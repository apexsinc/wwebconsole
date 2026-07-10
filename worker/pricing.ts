/**
 * Approximate USD→local display rates for marketing prices.
 * Rates are indicative (not live FX). Billing remains USD-based.
 */

export type LocalizedPrice = {
  yearlyPriceUsd: number;
  currency: string;
  amount: number;
  country: string;
  /** e.g. "₱2,800" or "$49" */
  formatted: string;
  /** e.g. "/ year / device" */
  periodLabel: string;
  /** Short note when converted from USD */
  note: string;
};

/** Country → ISO 4217 currency (common visitor markets). */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
  PR: 'USD',
  GU: 'USD',
  AS: 'USD',
  MP: 'USD',
  VI: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  UK: 'GBP',
  IE: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  LU: 'EUR',
  MT: 'EUR',
  CY: 'EUR',
  SK: 'EUR',
  SI: 'EUR',
  EE: 'EUR',
  LV: 'EUR',
  LT: 'EUR',
  AU: 'AUD',
  NZ: 'NZD',
  JP: 'JPY',
  KR: 'KRW',
  CN: 'CNY',
  HK: 'HKD',
  SG: 'SGD',
  MY: 'MYR',
  TH: 'THB',
  ID: 'IDR',
  PH: 'PHP',
  VN: 'VND',
  IN: 'INR',
  AE: 'AED',
  SA: 'SAR',
  QA: 'QAR',
  KW: 'KWD',
  BH: 'BHD',
  IL: 'ILS',
  TR: 'TRY',
  BR: 'BRL',
  MX: 'MXN',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  PE: 'PEN',
  ZA: 'ZAR',
  NG: 'NGN',
  EG: 'EGP',
  KE: 'KES',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  TW: 'TWD',
};

/** Units of local currency per 1 USD (approx). */
const USD_RATES: Record<string, number> = {
  USD: 1,
  CAD: 1.37,
  GBP: 0.79,
  EUR: 0.92,
  AUD: 1.53,
  NZD: 1.67,
  JPY: 155,
  KRW: 1350,
  CNY: 7.25,
  HKD: 7.82,
  SGD: 1.35,
  MYR: 4.7,
  THB: 36,
  IDR: 16200,
  PHP: 58,
  VND: 25400,
  INR: 83,
  AED: 3.67,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.38,
  ILS: 3.7,
  TRY: 32,
  BRL: 5.1,
  MXN: 17,
  ARS: 900,
  CLP: 950,
  COP: 4000,
  PEN: 3.7,
  ZAR: 18.5,
  NGN: 1550,
  EGP: 48,
  KES: 130,
  CHF: 0.89,
  SEK: 10.5,
  NOK: 10.7,
  DKK: 6.9,
  PLN: 4.0,
  CZK: 23,
  HUF: 360,
  RON: 4.6,
  TWD: 32,
};

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'COP']);

function roundAmount(currency: string, amount: number): number {
  if (ZERO_DECIMAL.has(currency)) return Math.round(amount);
  // Friendly marketing round: nearest whole for most, .00 for USD-like
  if (currency === 'USD' || currency === 'CAD' || currency === 'AUD' || currency === 'NZD' || currency === 'SGD') {
    return Math.round(amount);
  }
  return Math.round(amount);
}

export function currencyForCountry(country: string | null | undefined): string {
  const cc = (country || 'US').toUpperCase();
  if (cc === 'XX' || cc === 'T1' || !cc) return 'USD';
  return COUNTRY_CURRENCY[cc] || 'USD';
}

export function localizeYearlyPrice(usd: number, country: string | null | undefined): LocalizedPrice {
  const cc = (country || 'US').toUpperCase();
  const currency = currencyForCountry(cc);
  const rate = USD_RATES[currency] ?? 1;
  const amount = roundAmount(currency, usd * rate);
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    formatted = `${currency} ${amount}`;
  }

  return {
    yearlyPriceUsd: usd,
    currency,
    amount,
    country: cc === 'XX' || cc === 'T1' ? 'US' : cc,
    formatted,
    periodLabel: '/ year / device',
    note: currency === 'USD' ? '' : 'Shown in your local currency. Charged in USD.',
  };
}
