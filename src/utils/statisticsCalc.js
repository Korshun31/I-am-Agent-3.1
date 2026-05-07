import dayjs from 'dayjs';
import { computeMonthlyBreakdown } from './bookingPricing';
import { getCommissionEvents } from './ownerCommission';
import { convertAmount } from './currencyConvert';

const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

function getRentByMonth(b) {
  if (Array.isArray(b.monthlyBreakdown) && b.monthlyBreakdown.length > 0) return b.monthlyBreakdown;
  return computeMonthlyBreakdown(b.checkIn, b.checkOut, Number(b.priceMonthly) || 0);
}

function monthInRange(monthKey, fromStr, toStr) {
  const monthStart = `${monthKey}-01`;
  const monthEnd = dayjs(monthStart).endOf('month').format('YYYY-MM-DD');
  return monthEnd >= fromStr && monthStart <= toStr;
}

function dateInRange(dateStr, fromStr, toStr) {
  return dateStr >= fromStr && dateStr <= toStr;
}

function clientCommissionDate(b) {
  const created = b.createdAt ? String(b.createdAt).slice(0, 10) : null;
  const checkIn = b.checkIn ? String(b.checkIn).slice(0, 10) : null;
  if (created && checkIn) return created < checkIn ? created : checkIn;
  return created || checkIn || null;
}

// TD-120 фаза C: единая точка конвертации валют для всего файла. Если ctx не
// передан или конвертация невозможна — `convertAmount` молча вернёт исходное
// число. Это даёт обратную совместимость со старым кодом (вызовы без ctx
// продолжают работать как раньше) и graceful degrade при пустой таблице
// курсов на клиенте.
function fx(amount, b, ctx) {
  return convertAmount(amount, b, ctx?.today, ctx);
}

export function getPeriodPresets(now = dayjs()) {
  const startOfMonth = now.startOf('month');
  const endOfMonth   = now.endOf('month');
  const lastMonthStart = startOfMonth.subtract(1, 'month');
  const lastMonthEnd   = startOfMonth.subtract(1, 'day').endOf('day');
  const quarterStartMonth = Math.floor(now.month() / 3) * 3;
  const startOfQuarter = now.month(quarterStartMonth).startOf('month');
  const endOfQuarter   = now.month(quarterStartMonth + 2).endOf('month');
  const startOfYear    = now.startOf('year');
  const endOfYear      = now.endOf('year');
  return {
    thisMonth:   { from: startOfMonth.format('YYYY-MM-DD'),   to: endOfMonth.format('YYYY-MM-DD') },
    lastMonth:   { from: lastMonthStart.format('YYYY-MM-DD'), to: lastMonthEnd.format('YYYY-MM-DD') },
    thisQuarter: { from: startOfQuarter.format('YYYY-MM-DD'), to: endOfQuarter.format('YYYY-MM-DD') },
    thisYear:    { from: startOfYear.format('YYYY-MM-DD'),    to: endOfYear.format('YYYY-MM-DD') },
  };
}

export function computeRevenue(bookings, fromStr, toStr, ctx) {
  return (bookings || []).reduce((sum, b) => {
    if (b.notMyCustomer) return sum;
    const rows = getRentByMonth(b);
    return sum + rows.reduce((s, r) => {
      if (!r.month || !monthInRange(r.month, fromStr, toStr)) return s;
      return s + fx(Number(r.amount) || 0, b, ctx);
    }, 0);
  }, 0);
}

export function computeAgencyIncome(bookings, fromStr, toStr, ctx) {
  return (bookings || []).reduce((sum, b) => {
    if (b.notMyCustomer) return sum;
    let acc = 0;

    const fromClient = Number(b.commission) || 0;
    const ccDate = clientCommissionDate(b);
    if (fromClient > 0 && ccDate) {
      if (dateInRange(ccDate, fromStr, toStr)) acc += fx(fromClient, b, ctx);
    }

    const events = getCommissionEvents(b);
    events.forEach((d) => {
      if (dateInRange(d.date, fromStr, toStr)) acc += fx(Number(d.amount) || 0, b, ctx);
    });

    return sum + acc;
  }, 0);
}

export function breakdownByPropertyForMonth(bookings, properties, monthKey, ctx) {
  const byProp = {};

  (bookings || []).forEach((b) => {
    if (b.notMyCustomer) return;
    if (!b.propertyId) return;

    let revenue = 0;
    let income = 0;
    const sources = new Set();

    const rows = getRentByMonth(b);
    rows.forEach((r) => {
      if (r.month === monthKey) revenue += fx(Number(r.amount) || 0, b, ctx);
    });

    const fromClient = Number(b.commission) || 0;
    const ccDate = clientCommissionDate(b);
    if (fromClient > 0 && ccDate) {
      const ccMonth = ccDate.slice(0, 7);
      if (ccMonth === monthKey) {
        income += fx(fromClient, b, ctx);
        sources.add('KK');
      }
    }

    getCommissionEvents(b).forEach((d) => {
      if (String(d.date).slice(0, 7) === monthKey) {
        income += fx(Number(d.amount) || 0, b, ctx);
        sources.add(d.type === 'oneTime' ? 'KoS' : 'EKoS');
      }
    });

    if (revenue === 0 && income === 0) return;

    if (!byProp[b.propertyId]) byProp[b.propertyId] = { propertyId: b.propertyId, revenue: 0, agencyIncome: 0, sources: new Set() };
    byProp[b.propertyId].revenue += revenue;
    byProp[b.propertyId].agencyIncome += income;
    sources.forEach((src) => byProp[b.propertyId].sources.add(src));
  });

  const propsMap = {};
  (properties || []).forEach((p) => { propsMap[p.id] = p; });

  const ORDER = ['KK', 'KoS', 'EKoS'];
  return Object.values(byProp).map((agg) => {
    const p = propsMap[agg.propertyId];
    const fullCode = p ? (p.code || '—') + (p.code_suffix ? `-${p.code_suffix}` : '') : '—';
    const sourcesArr = ORDER.filter((s) => agg.sources.has(s));
    return {
      propertyId: agg.propertyId,
      revenue: agg.revenue,
      agencyIncome: agg.agencyIncome,
      sources: sourcesArr,
      code: fullCode,
      name: p?.name || '—',
      city: p?.city || '',
      photo: (Array.isArray(p?.photos_thumb) && p.photos_thumb[0]) || (Array.isArray(p?.photos) && p.photos[0]) || null,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

export function computeActiveBookingsCount(bookings, now = dayjs()) {
  return (bookings || []).filter((b) => {
    if (b.notMyCustomer) return false;
    const start = dayjs(b.checkIn);
    const end   = dayjs(b.checkOut);
    return now.isAfter(start) && now.isBefore(end);
  }).length;
}

function isRentableUnit(p) {
  return !!(p && HOUSE_LIKE_TYPES.has(p.type));
}

export function computeOccupancyPercent(bookings, properties, fromStr, toStr) {
  const rentables = (properties || []).filter(isRentableUnit);
  if (rentables.length === 0) return 0;

  const from = dayjs(fromStr);
  const to   = dayjs(toStr);
  const totalDays = to.diff(from, 'day') + 1;
  if (totalDays <= 0) return 0;

  const available = rentables.length * totalDays;
  const rentableIds = new Set(rentables.map((p) => p.id));

  let occupiedNights = 0;
  (bookings || []).forEach((b) => {
    if (!rentableIds.has(b.propertyId)) return;
    const ci = dayjs(b.checkIn);
    const co = dayjs(b.checkOut);
    const start = ci.isAfter(from) ? ci : from;
    const end   = co.isBefore(to) ? co : to;
    const nights = end.diff(start, 'day');
    if (nights > 0) occupiedNights += nights;
  });

  return Math.round((occupiedNights / available) * 100);
}

// TD-121: формулы выровнены с `computeRevenue` / `computeAgencyIncome`.
// Раньше revenue считался как `b.totalPrice` для броней с checkIn в периоде —
// это давало два расхождения: (1) многомесячные брони "схлопывались" в один
// период вместо разбивки по месяцам через monthlyBreakdown; (2) брони с
// checkIn вне периода но имеющие rent в периоде вообще не попадали.
// Теперь revenue идёт через `getRentByMonth` + `monthInRange`, agencyIncome
// через `getCommissionEvents` + `dateInRange` — точно как в
// `computeRevenue`/`computeAgencyIncome`/`computeAgentLeaderboard`. Числа в
// топе теперь сходятся с общим оборотом и доходом за тот же период.
export function computeTopProperties(bookings, properties, fromStr, toStr, limit = 5, ctx) {
  const fromD = dayjs(fromStr);
  const toD   = dayjs(toStr);
  const totalDays = toD.diff(fromD, 'day') + 1;

  const byProp = {};
  (bookings || []).forEach((b) => {
    if (b.notMyCustomer) return;
    if (!b.propertyId) return;

    let revenue = 0;
    const rows = getRentByMonth(b);
    rows.forEach((r) => {
      if (r.month && monthInRange(r.month, fromStr, toStr)) revenue += fx(Number(r.amount) || 0, b, ctx);
    });

    let income = 0;
    const fromClient = Number(b.commission) || 0;
    const ccDate = clientCommissionDate(b);
    if (fromClient > 0 && ccDate && dateInRange(ccDate, fromStr, toStr)) income += fx(fromClient, b, ctx);

    getCommissionEvents(b).forEach((d) => {
      if (dateInRange(d.date, fromStr, toStr)) income += fx(Number(d.amount) || 0, b, ctx);
    });

    if (revenue === 0 && income === 0) return;

    if (!byProp[b.propertyId]) byProp[b.propertyId] = { revenue: 0, agencyIncome: 0, nights: 0, count: 0 };
    byProp[b.propertyId].revenue      += revenue;
    byProp[b.propertyId].agencyIncome += income;
    byProp[b.propertyId].count        += 1;

    const ci = dayjs(b.checkIn);
    const co = dayjs(b.checkOut);
    const start = ci.isAfter(fromD) ? ci : fromD;
    const end   = co.isBefore(toD) ? co : toD;
    const n = end.diff(start, 'day');
    if (n > 0) byProp[b.propertyId].nights += n;
  });

  const propsMap = {};
  (properties || []).forEach((p) => { propsMap[p.id] = p; });

  return Object.entries(byProp)
    .map(([id, agg]) => {
      const p = propsMap[id];
      return {
        id,
        name: p?.name || '—',
        code: p?.code || '',
        revenue: agg.revenue,
        agencyIncome: agg.agencyIncome,
        nights: agg.nights,
        count: agg.count,
        occupancyPercent: totalDays > 0 ? Math.round((agg.nights / totalDays) * 100) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function buildMonthEntry(bookings, m, isCurrent = false, ctx) {
  const fromStr = m.startOf('month').format('YYYY-MM-DD');
  const toStr   = m.endOf('month').format('YYYY-MM-DD');
  return {
    key: m.format('YYYY-MM'),
    label: m.format('MMM'),
    year: m.year(),
    isCurrent,
    revenue:      computeRevenue(bookings, fromStr, toStr, ctx),
    agencyIncome: computeAgencyIncome(bookings, fromStr, toStr, ctx),
  };
}

export function computeMonthlyRevenue(bookings, monthsBack = 12, now = dayjs(), ctx) {
  const out = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    out.push(buildMonthEntry(bookings, now.subtract(i, 'month'), i === 0, ctx));
  }
  return out;
}

export function computeMonthlyForecast(bookings, monthsAhead = 12, now = dayjs(), ctx) {
  const out = [];
  for (let i = 1; i <= monthsAhead; i++) {
    out.push(buildMonthEntry(bookings, now.add(i, 'month'), false, ctx));
  }
  return out;
}

export function computeMonthlyBookingsCount(bookings, monthsBack = 5, monthsAhead = 6, now = dayjs()) {
  const out = [];
  const list = bookings || [];
  for (let i = -monthsBack; i <= monthsAhead; i++) {
    const m = i < 0 ? now.subtract(-i, 'month') : (i === 0 ? now : now.add(i, 'month'));
    const fromStr = m.startOf('month').format('YYYY-MM-DD');
    const toStr   = m.endOf('month').format('YYYY-MM-DD');
    const created = list.filter((b) => {
      if (b.notMyCustomer) return false;
      if (!b.createdAt) return false;
      const d = String(b.createdAt).slice(0, 10);
      return d >= fromStr && d <= toStr;
    }).length;
    const checkedIn = list.filter((b) => {
      if (b.notMyCustomer) return false;
      if (!b.checkIn) return false;
      return b.checkIn >= fromStr && b.checkIn <= toStr;
    }).length;
    out.push({
      key: m.format('YYYY-MM'),
      label: m.format('MMM'),
      year: m.year(),
      isCurrent: i === 0,
      created,
      checkedIn,
    });
  }
  return out;
}

export function computeAgentLeaderboard(bookings, teamMembers, fromStr, toStr, limit = 5, ctx) {
  const memberMap = {};
  (teamMembers || []).forEach((m) => {
    const id = m.user_id ?? m.id;
    if (!id) return;
    const name = [m.name, m.last_name || m.lastName].filter(Boolean).join(' ').trim() || m.email || '—';
    memberMap[id] = { id, name };
  });

  const byAgent = {};
  (bookings || []).forEach((b) => {
    if (b.notMyCustomer) return;

    let revenue = 0;
    const rows = getRentByMonth(b);
    rows.forEach((r) => {
      if (r.month && monthInRange(r.month, fromStr, toStr)) revenue += fx(Number(r.amount) || 0, b, ctx);
    });

    let income = 0;
    const fromClient = Number(b.commission) || 0;
    const ccDate = clientCommissionDate(b);
    if (fromClient > 0 && ccDate && dateInRange(ccDate, fromStr, toStr)) income += fx(fromClient, b, ctx);

    getCommissionEvents(b).forEach((d) => {
      if (dateInRange(d.date, fromStr, toStr)) income += fx(Number(d.amount) || 0, b, ctx);
    });

    if (revenue === 0 && income === 0) return;

    const id = b.responsibleAgentId || '__company__';
    if (!byAgent[id]) byAgent[id] = { id, count: 0, revenue: 0, agencyIncome: 0 };
    byAgent[id].count        += 1;
    byAgent[id].revenue      += revenue;
    byAgent[id].agencyIncome += income;
  });

  return Object.values(byAgent)
    .map((agg) => ({
      ...agg,
      name: agg.id === '__company__' ? null : (memberMap[agg.id]?.name || '—'),
      isCompany: agg.id === '__company__',
    }))
    .sort((a, b) => b.agencyIncome - a.agencyIncome)
    .slice(0, limit);
}

export function filterBookingsForUser(bookings, user) {
  if (!user?.teamMembership) return bookings || [];
  return (bookings || []).filter((b) => b.responsibleAgentId === user.id);
}

export function filterPropertiesForUser(properties, user) {
  if (!user?.teamMembership) return properties || [];
  return (properties || []).filter((p) => p.responsible_agent_id === user.id);
}
