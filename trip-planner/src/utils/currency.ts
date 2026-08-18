// Base currency is USD. Rates are relative to 1 USD.
// In a production app, these would be fetched dynamically.
export const EXCHANGE_RATES: Record<string, number> = {
  'USD': 1.0,
  'EUR': 0.91,
  'GBP': 0.78,
  'JPY': 149.50,
  'RUB': 92.50,
  'AUD': 1.53,
  'CAD': 1.35,
  'CNY': 7.23
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'RUB': '₽',
  'AUD': 'A$',
  'CAD': 'C$',
  'CNY': '¥'
};

/**
 * Converts an amount from one currency to another.
 */
export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;
  
  const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
  const toRate = EXCHANGE_RATES[toCurrency] || 1;
  
  // Convert to USD first, then to target currency
  const amountInUSD = amount / fromRate;
  return amountInUSD * toRate;
}

/**
 * Formats an amount with its proper currency symbol.
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
