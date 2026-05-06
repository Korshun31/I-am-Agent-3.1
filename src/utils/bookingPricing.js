// Общие функции расчёта стоимости бронирования.
// Используются и на вебе, и на мобильном — единый алгоритм для обеих платформ.
// TD-080: помесячная аренда. TD-082: помесячная разбивка стоимости.

/**
 * Считает общую стоимость аренды:
 * — каждый полный месяц = priceMonthly;
 * — последний неполный месяц = priceMonthly × (дни остатка / дни в месяце), округлённо.
 * Возвращает целое число или null если данных недостаточно.
 */
export function computeTotalPrice(checkIn, checkOut, priceMonthly) {
  if (!checkIn || !checkOut || !priceMonthly || priceMonthly <= 0) return null;
  const p = Number(priceMonthly);
  const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const end = checkOut instanceof Date ? checkOut : new Date(checkOut);
  if (start >= end) return null;

  let total = 0;
  let current = new Date(start);
  while (current < end) {
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
    if (nextMonth <= end) {
      total += p;
      current = nextMonth;
    } else {
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const daysRemaining = Math.round((end - current) / 86400000);
      total += Math.round(p / daysInMonth * daysRemaining);
      current = end;
    }
  }
  return total;
}

/**
 * TD-082: помесячная разбивка стоимости. Возвращает массив объектов:
 *   [{ month: 'YYYY-MM', amount: число }, ...]
 * Алгоритм такой же как computeTotalPrice — каждый полный месяц priceMonthly,
 * последний неполный — пропорционально дням. Только результат не суммируется,
 * а копится по месяцам. Юзер потом может вручную поправить любую сумму.
 * Если входных данных недостаточно — пустой массив.
 */
export function computeMonthlyBreakdown(checkIn, checkOut, priceMonthly) {
  if (!checkIn || !checkOut || !priceMonthly || priceMonthly <= 0) return [];
  const p = Number(priceMonthly);
  const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const end = checkOut instanceof Date ? checkOut : new Date(checkOut);
  if (start >= end) return [];

  const result = [];
  let current = new Date(start);
  while (current < end) {
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    if (nextMonth <= end) {
      result.push({ month: monthKey, amount: p });
      current = nextMonth;
    } else {
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const daysRemaining = Math.round((end - current) / 86400000);
      result.push({ month: monthKey, amount: Math.round(p / daysInMonth * daysRemaining) });
      current = end;
    }
  }
  return result;
}
