// Currency symbols map
export const CURRENCY_SYMBOLS = {
  THB: '฿',
  USD: '$',
  EUR: '€',
  RUB: '₽',
};

export function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency || '฿';
}

/**
 * Format a price with its currency symbol.
 * e.g. formatPrice(20000, 'THB') → '20 000 ฿'
 *      formatPrice(500, 'USD')   → '$ 500'
 */
export function formatPrice(amount, currency) {
  if (amount == null || amount === '') return '—';
  const sym = getCurrencySymbol(currency);
  const formatted = Number(amount).toLocaleString('ru-RU');
  // THB and RUB: symbol after number; USD and EUR: symbol before
  if (currency === 'USD' || currency === 'EUR') {
    return `${sym} ${formatted}`;
  }
  return `${formatted} ${sym}`;
}
