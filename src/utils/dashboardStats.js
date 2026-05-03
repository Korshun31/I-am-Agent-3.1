import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { eventOccursOnDate } from '../services/calendarEventsService';
import { getCommissionDateAmounts } from '../services/commissionRemindersService';

dayjs.extend(isBetween);

const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

export function buildPropertiesMap(properties) {
  const m = {};
  (properties || []).forEach((p) => { m[p.id] = p; });
  return m;
}

function isRentableUnit(p) {
  return !!(p && HOUSE_LIKE_TYPES.has(p.type));
}

function categoryKeyRentable(p, propsMap) {
  if (!isRentableUnit(p)) return null;
  if (!p.parent_id) return 'houses';
  const parent = propsMap[p.parent_id];
  if (parent?.type === 'resort') return 'resortHouses';
  if (parent?.type === 'condo') return 'apartments';
  return null;
}

export function breakdownByCategory(properties, propsMap, filterFn) {
  let houses = 0;
  let resortHouses = 0;
  let apartments = 0;
  (properties || []).forEach((p) => {
    if (filterFn && !filterFn(p)) return;
    const key = categoryKeyRentable(p, propsMap);
    if (!key) return;
    if (key === 'houses') houses += 1;
    else if (key === 'resortHouses') resortHouses += 1;
    else apartments += 1;
  });
  return {
    houses,
    resortHouses,
    apartments,
    total: houses + resortHouses + apartments,
  };
}

export function computeBaseStats({ properties, bookings, user, now = dayjs() }) {
  const isTeamMemberStats = !!(user?.teamMembership);
  const propsMap = buildPropertiesMap(properties);
  const filter = isTeamMemberStats ? (p) => p.responsible_agent_id === user.id : null;
  const cat = breakdownByCategory(properties, propsMap, filter);

  const endOfMonth = now.endOf('month');
  let myClients = 0;
  let otherClients = 0;
  const bookingsForStats = isTeamMemberStats
    ? (bookings || []).filter((b) => b.responsibleAgentId === user.id)
    : (bookings || []);

  const occupied = bookingsForStats.filter((b) => {
    const start = dayjs(b.checkIn);
    const end = dayjs(b.checkOut);
    const isOccupied = now.isAfter(start) && now.isBefore(end);
    if (isOccupied) {
      if (b.notMyCustomer) otherClients++;
      else myClients++;
    }
    return isOccupied;
  }).length;

  const upcomingBookings = bookingsForStats.filter((b) => dayjs(b.checkIn).isAfter(now));
  const thisMonth = upcomingBookings.filter((b) => dayjs(b.checkIn).isBefore(endOfMonth)).length;

  return {
    total: cat.total,
    houses: cat.houses,
    resortHouses: cat.resortHouses,
    apartments: cat.apartments,
    occupied,
    myClients,
    otherClients,
    upcoming: upcomingBookings.length,
    thisMonth,
    later: upcomingBookings.length - thisMonth,
  };
}

export function computeAgentStats({ properties, bookings, user, now = dayjs() }) {
  if (!user?.teamMembership) return null;
  const propsMap = buildPropertiesMap(properties);
  const endOfMonth = now.endOf('month');

  const companyBd = breakdownByCategory(properties, propsMap, null);
  const myBd = breakdownByCategory(properties, propsMap, (p) => p.responsible_agent_id === user?.id);

  let companyAgencyActive = 0;
  let companyOwnerActive = 0;
  let myAgencyActive = 0;
  (bookings || []).forEach((b) => {
    const start = dayjs(b.checkIn);
    const end = dayjs(b.checkOut);
    if (!now.isAfter(start) || !now.isBefore(end)) return;
    if (b.notMyCustomer) {
      companyOwnerActive++;
    } else {
      companyAgencyActive++;
      if (b.responsibleAgentId === user.id) myAgencyActive++;
    }
  });

  const allFutureAgency = (bookings || []).filter((b) => !b.notMyCustomer && dayjs(b.checkIn).isAfter(now));
  const myFutureAgency = allFutureAgency.filter((b) => b.responsibleAgentId === user.id);
  const companyUpcoming = allFutureAgency.length;
  const myUpcoming = myFutureAgency.length;
  const myThisMonth = myFutureAgency.filter((b) => dayjs(b.checkIn).isBefore(endOfMonth)).length;
  const myLater = myUpcoming - myThisMonth;

  const todayStr = now.format('YYYY-MM-DD');
  const endOfWeek = now.endOf('week');
  const myBookings = (bookings || []).filter((b) => b.responsibleAgentId === user.id && !b.notMyCustomer);
  const myCheckInToday = myBookings.filter((b) => b.checkIn === todayStr).length;
  const myCheckInWeek = myBookings.filter((b) => {
    const d = dayjs(b.checkIn);
    return d.isAfter(now.startOf('day').subtract(1, 'ms')) && d.isBefore(endOfWeek.add(1, 'ms'));
  }).length;
  const myCheckInMonth = myBookings.filter((b) => {
    const d = dayjs(b.checkIn);
    return d.isAfter(now.startOf('month').subtract(1, 'ms')) && d.isBefore(endOfMonth.add(1, 'ms'));
  }).length;

  return {
    companyTotal: companyBd.total,
    companyHouses: companyBd.houses,
    companyResorts: companyBd.resortHouses,
    companyCondos: companyBd.apartments,
    myTotal: myBd.total,
    myHouses: myBd.houses,
    myResorts: myBd.resortHouses,
    myCondos: myBd.apartments,
    companyAgencyActive,
    companyOwnerActive,
    myAgencyActive,
    companyTotalActive: companyAgencyActive + companyOwnerActive,
    companyUpcoming,
    myUpcoming,
    myThisMonth,
    myLater,
    myCheckInToday,
    myCheckInWeek,
    myCheckInMonth,
  };
}

export function buildCommissionEvents({ bookings, properties }) {
  const out = [];
  (bookings || []).forEach((b) => {
    if (!b.ownerCommissionOneTime && !b.ownerCommissionMonthly) return;
    const pm = Number(b.priceMonthly) || 0;
    const oneTimeEff = b.ownerCommissionOneTimeIsPercent && pm > 0
      ? Math.round((Number(b.ownerCommissionOneTime) / 100) * pm)
      : b.ownerCommissionOneTime;
    const monthlyEff = b.ownerCommissionMonthlyIsPercent && pm > 0
      ? Math.round((Number(b.ownerCommissionMonthly) / 100) * pm)
      : b.ownerCommissionMonthly;
    const dates = getCommissionDateAmounts(b.checkIn, b.checkOut, oneTimeEff, monthlyEff);
    const prop = (properties || []).find((p) => p.id === b.propertyId);
    dates.forEach((d) => {
      out.push({
        ...d,
        id: `comm-${b.id}-${d.date}`,
        bookingId: b.id,
        propertyId: b.propertyId,
        propertyCode: prop?.code || '—',
        propertyName: prop?.name || '—',
        currency: prop?.currency || 'THB',
        type: 'COMMISSION',
      });
    });
  });
  return out;
}

export function computeAgendaForDate({
  date,
  user,
  properties,
  bookings,
  contacts,
  calendarEvents,
  commissionEvents,
  noNameFallback = '—',
}) {
  const dateStr = date.format('YYYY-MM-DD');
  const isTeamMember = !!(user?.teamMembership);
  const propsMap = buildPropertiesMap(properties);

  const enrich = (b) => {
    const prop = propsMap[b.propertyId];
    const client = (contacts || []).find((c) => c.id === b.contactId);
    return {
      ...b,
      propertyName: prop?.name || noNameFallback,
      propertyCode: prop?.code || '—',
      clientName: client ? `${client.name} ${client.lastName}` : '—',
      clientPhone: client?.phone || '',
      clientTelegram: client?.telegram || '',
    };
  };

  const ins = (bookings || []).filter((b) => {
    if (b.checkIn !== dateStr || b.notMyCustomer) return false;
    if (isTeamMember) return propsMap[b.propertyId]?.responsible_agent_id === user.id;
    return true;
  }).map(enrich);

  const outs = (bookings || []).filter((b) => {
    if (b.checkOut !== dateStr) return false;
    if (isTeamMember) return propsMap[b.propertyId]?.responsible_agent_id === user.id;
    return true;
  }).map(enrich);

  const commissions = (commissionEvents || []).filter((c) => {
    if (c.date !== dateStr) return false;
    if (isTeamMember) return propsMap[c.propertyId]?.responsible_agent_id === user.id;
    return true;
  });

  const personal = (calendarEvents || [])
    .filter((e) => eventOccursOnDate(e, dateStr))
    .map((e) => ({
      ...e,
      type: 'PERSONAL',
      time: e.eventTime,
    }));

  return {
    checkIns: ins,
    checkOuts: outs,
    personal: [...personal, ...commissions],
  };
}
