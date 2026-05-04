import dayjs from 'dayjs';

const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

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

function bookingsInPeriodByCheckIn(bookings, fromStr, toStr) {
  return (bookings || []).filter((b) => {
    if (b.notMyCustomer) return false;
    const ci = b.checkIn;
    return ci >= fromStr && ci <= toStr;
  });
}

export function computeRevenue(bookings, fromStr, toStr) {
  return bookingsInPeriodByCheckIn(bookings, fromStr, toStr)
    .reduce((sum, b) => sum + (Number(b.totalPrice) || 0), 0);
}

function monthsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diff = dayjs(checkOut).diff(dayjs(checkIn), 'day');
  return Math.max(1, diff / 30);
}

export function computeAgencyIncome(bookings, fromStr, toStr) {
  return bookingsInPeriodByCheckIn(bookings, fromStr, toStr).reduce((sum, b) => {
    const pm = Number(b.priceMonthly) || 0;
    const fromClient = Number(b.commission) || 0;

    let oneTime = 0;
    if (b.ownerCommissionOneTime != null) {
      oneTime = b.ownerCommissionOneTimeIsPercent
        ? Math.round((Number(b.ownerCommissionOneTime) / 100) * pm)
        : Number(b.ownerCommissionOneTime);
    }

    let monthly = 0;
    if (b.ownerCommissionMonthly != null) {
      const perMonth = b.ownerCommissionMonthlyIsPercent
        ? Math.round((Number(b.ownerCommissionMonthly) / 100) * pm)
        : Number(b.ownerCommissionMonthly);
      monthly = perMonth * monthsBetween(b.checkIn, b.checkOut);
    }

    return sum + fromClient + oneTime + monthly;
  }, 0);
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

export function computeTopProperties(bookings, properties, fromStr, toStr, limit = 5) {
  const list = bookingsInPeriodByCheckIn(bookings, fromStr, toStr);
  const fromD = dayjs(fromStr);
  const toD   = dayjs(toStr);
  const totalDays = toD.diff(fromD, 'day') + 1;

  const byProp = {};
  list.forEach((b) => {
    if (!b.propertyId) return;
    if (!byProp[b.propertyId]) byProp[b.propertyId] = { revenue: 0, nights: 0, count: 0 };
    byProp[b.propertyId].revenue += Number(b.totalPrice) || 0;
    byProp[b.propertyId].count += 1;
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
        nights: agg.nights,
        count: agg.count,
        occupancyPercent: totalDays > 0 ? Math.round((agg.nights / totalDays) * 100) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function buildMonthEntry(bookings, m, isCurrent = false) {
  const fromStr = m.startOf('month').format('YYYY-MM-DD');
  const toStr   = m.endOf('month').format('YYYY-MM-DD');
  return {
    key: m.format('YYYY-MM'),
    label: m.format('MMM'),
    year: m.year(),
    isCurrent,
    revenue:      computeRevenue(bookings, fromStr, toStr),
    agencyIncome: computeAgencyIncome(bookings, fromStr, toStr),
  };
}

export function computeMonthlyRevenue(bookings, monthsBack = 12, now = dayjs()) {
  const out = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    out.push(buildMonthEntry(bookings, now.subtract(i, 'month'), i === 0));
  }
  return out;
}

export function computeMonthlyForecast(bookings, monthsAhead = 12, now = dayjs()) {
  const out = [];
  for (let i = 1; i <= monthsAhead; i++) {
    out.push(buildMonthEntry(bookings, now.add(i, 'month')));
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

export function computeAgentLeaderboard(bookings, teamMembers, fromStr, toStr, limit = 5) {
  const list = bookingsInPeriodByCheckIn(bookings, fromStr, toStr);

  const memberMap = {};
  (teamMembers || []).forEach((m) => {
    const id = m.user_id ?? m.id;
    if (!id) return;
    const name = [m.name, m.last_name || m.lastName].filter(Boolean).join(' ').trim() || m.email || '—';
    memberMap[id] = { id, name };
  });

  const byAgent = {};
  list.forEach((b) => {
    const id = b.responsibleAgentId || '__company__';
    if (!byAgent[id]) byAgent[id] = { id, count: 0, revenue: 0, agencyIncome: 0 };
    byAgent[id].count   += 1;
    byAgent[id].revenue += Number(b.totalPrice) || 0;

    const pm = Number(b.priceMonthly) || 0;
    const fromClient = Number(b.commission) || 0;
    let oneTime = 0;
    if (b.ownerCommissionOneTime != null) {
      oneTime = b.ownerCommissionOneTimeIsPercent
        ? Math.round((Number(b.ownerCommissionOneTime) / 100) * pm)
        : Number(b.ownerCommissionOneTime);
    }
    let monthly = 0;
    if (b.ownerCommissionMonthly != null) {
      const perMonth = b.ownerCommissionMonthlyIsPercent
        ? Math.round((Number(b.ownerCommissionMonthly) / 100) * pm)
        : Number(b.ownerCommissionMonthly);
      monthly = perMonth * monthsBetween(b.checkIn, b.checkOut);
    }
    byAgent[id].agencyIncome += fromClient + oneTime + monthly;
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
