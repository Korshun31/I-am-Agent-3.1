// TD-120: получение текущих курсов валют с публичного API fxratesapi.com.
// Без ключа, без регистрации, отдаёт USD/EUR/THB/RUB одним запросом, CORS
// открыт. Возвращает массив строк той же формы что раньше отдавал Supabase
// (`{ rate_date, base_currency, quote_currency, rate }`), чтобы остальной
// код (`indexRates` → `lookupRate` → `convertAmount`) ничего не менял.
//
// Тянем только сегодняшние курсы (latest). Это значит для броней с
// прошлой датой будет применён сегодняшний курс — не строго точно, но
// расхождение в 1-3% за год не существенно для статистики аренды.
// Если в будущем понадобится история — добавим вторым запросом
// `/historical?date=...` для уникальных дат броней.

const API_URL = 'https://api.fxratesapi.com/latest?base=USD&currencies=EUR,THB,RUB';
const SUPPORTED = new Set(['USD', 'EUR', 'THB', 'RUB']);

export async function fetchRates() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`fxratesapi HTTP ${res.status}`);
  const json = await res.json();
  if (!json || !json.rates) throw new Error('fxratesapi: missing rates field');

  const rateDate = (json.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const out = [];
  for (const [quote, rate] of Object.entries(json.rates)) {
    if (!SUPPORTED.has(quote)) continue;
    if (quote === 'USD') continue;                 // self
    const r = Number(rate);
    if (!(r > 0)) continue;
    out.push({ rate_date: rateDate, base_currency: 'USD', quote_currency: quote, rate: r });
  }
  return out;
}
