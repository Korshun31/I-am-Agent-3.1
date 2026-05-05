// TD-120 фаза C: конвертация сумм между валютами по курсу даты.
//
// Источник курсов — массив строк из таблицы `currency_rates` Supabase
// (`{ rate_date, base_currency, quote_currency, rate }`). Базовая валюта
// у всех строк USD; кросс-курсы (THB→RUB и т.п.) считаются на лету через
// USD как опорную базу.
//
// Поведение при отсутствующих данных — graceful degrade:
//   - rates пустые / отсутствуют → возвращается amount как есть
//   - валюта брони не определена и нет fallback-а на property → в ту же
//     отчётную валюту (no-op)
//   - курс на конкретную дату не найден → ищем ближайший более ранний
//     до 30 дней назад через бинарный поиск
//   - курс не найден даже за 30 дней → возвращаем amount без конвертации
//     (один раз пишем console.warn чтобы не засорять консоль)

const VALID = new Set(['USD', 'EUR', 'THB', 'RUB']);
const MAX_FALLBACK_DAYS = 30;
const BASE = 'USD';

let _warned = false;
function warnOnce(msg) {
  if (_warned) return;
  _warned = true;
  // eslint-disable-next-line no-console
  console.warn(msg);
}

/**
 * Строит индекс из плоского списка строк currency_rates в Map'ы для O(log n)
 * поиска по дате. Ключ внешней Map — пара `${base}|${quote}` (всегда вида
 * `USD|XXX`). Значение — отсортированный по возрастанию массив `[date, rate]`.
 *
 * Вызывать один раз при загрузке курсов (в CurrencyRatesContext); хранить
 * результат в state и пробрасывать в statisticsCalc через ctx.rates.
 */
export function indexRates(rows) {
  const byPair = new Map();
  (rows || []).forEach((r) => {
    if (!r || !r.rate_date || !r.base_currency || !r.quote_currency) return;
    const rate = Number(r.rate);
    if (!(rate > 0)) return;
    const key = `${r.base_currency}|${r.quote_currency}`;
    let arr = byPair.get(key);
    if (!arr) { arr = []; byPair.set(key, arr); }
    arr.push([r.rate_date, rate]);
  });
  // Сортировка по возрастанию даты — данные из БД уже отсортированы (ORDER BY
  // rate_date ASC в `fetchRates`), но на всякий случай делаем явно.
  byPair.forEach((arr) => arr.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
  return byPair;
}

/**
 * Бинарный поиск: возвращает курс на дату ≤ dateStr, не далее MAX_FALLBACK_DAYS
 * от dateStr. null если такого нет.
 */
function lookupRate(byPair, base, quote, dateStr) {
  if (base === quote) return 1;
  const arr = byPair.get(`${base}|${quote}`);
  if (!arr || arr.length === 0) return null;

  // Бинарный поиск последней записи с rate_date <= dateStr.
  let lo = 0;
  let hi = arr.length - 1;
  let foundIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid][0] <= dateStr) { foundIdx = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (foundIdx < 0) return null;

  const [foundDate, foundRate] = arr[foundIdx];

  // Проверка возраста: разница в днях между запрошенной датой и найденной.
  const a = new Date(`${dateStr}T00:00:00Z`).getTime();
  const b = new Date(`${foundDate}T00:00:00Z`).getTime();
  const diffDays = Math.floor((a - b) / 86400000);
  if (diffDays > MAX_FALLBACK_DAYS) return null;

  return foundRate;
}

/**
 * Курс fromCurrency → targetCurrency на дату dateStr. Кросс-курсы вычисляются
 * через USD: rate(THB→RUB) = rate(USD→RUB) / rate(USD→THB).
 */
function rateFor(byPair, fromCurrency, targetCurrency, dateStr) {
  if (fromCurrency === targetCurrency) return 1;
  if (fromCurrency === BASE) return lookupRate(byPair, BASE, targetCurrency, dateStr);
  if (targetCurrency === BASE) {
    const r = lookupRate(byPair, BASE, fromCurrency, dateStr);
    return r ? 1 / r : null;
  }
  // Кросс через USD.
  const a = lookupRate(byPair, BASE, fromCurrency, dateStr);
  const b = lookupRate(byPair, BASE, targetCurrency, dateStr);
  if (!a || !b) return null;
  return b / a;
}

/**
 * Дата для поиска курса конкретной брони:
 *   - если бронь уже наступила (today >= checkIn) — фиксируем по checkIn,
 *     это «исторический» курс заезда, стабильный для прошлых отчётов;
 *   - иначе (бронь будущая) — берём дату создания брони, чтобы прогноз
 *     не плавал каждый день вместе с курсом.
 *
 * Возвращает строку YYYY-MM-DD. Если ни одной даты нет — null.
 */
export function bookingFxDate(b, today) {
  const ci = b?.checkIn ? String(b.checkIn).slice(0, 10) : null;
  const ca = b?.createdAt ? String(b.createdAt).slice(0, 10) : null;
  const todayStr = today ? String(today).slice(0, 10) : new Date().toISOString().slice(0, 10);
  if (ci && todayStr >= ci) return ci;
  return ca || ci || null;
}

/**
 * Резолвит валюту брони с фолбэком на валюту объекта (если карта передана)
 * и потом на отчётную валюту. Это центральная точка — вся остальная логика
 * полагается на то, что `bookingCurrency` всегда вернёт валидный код.
 */
export function bookingCurrency(b, ctx) {
  const own = b?.currency;
  if (own && VALID.has(own)) return own;
  const propMap = ctx?.propertyCurrencyById;
  if (propMap && b?.propertyId) {
    const fromProp = propMap.get(b.propertyId);
    if (fromProp && VALID.has(fromProp)) return fromProp;
  }
  return ctx?.targetCurrency && VALID.has(ctx.targetCurrency) ? ctx.targetCurrency : null;
}

/**
 * Главный хелпер для использования в statisticsCalc. Конвертирует amount из
 * валюты брони в отчётную валюту по курсу на дату брони.
 *
 * Если ctx не передан или конвертация невозможна — возвращает amount как есть.
 * Это даёт обратную совместимость со старым кодом и graceful degrade при
 * пустой таблице курсов.
 */
export function convertAmount(amount, b, today, ctx) {
  const num = Number(amount) || 0;
  if (!ctx || !ctx.rates || !ctx.targetCurrency) return num;
  const from = bookingCurrency(b, ctx);
  if (!from) return num;
  if (from === ctx.targetCurrency) return num;

  const date = bookingFxDate(b, today);
  if (!date) return num;

  const r = rateFor(ctx.rates, from, ctx.targetCurrency, date);
  if (!r) {
    warnOnce(`convertAmount: no rate ${from}→${ctx.targetCurrency} for ${date} (booking ${b?.id || '?'})`);
    return num;
  }
  return num * r;
}
