import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { eventOccursOnDate } from '../services/calendarEventsService';
import { getCommissionEvents } from './ownerCommission';

dayjs.extend(isBetween);

export function buildPropertiesMap(properties) {
  const m = {};
  (properties || []).forEach((p) => { m[p.id] = p; });
  return m;
}

// Подсчёт «контейнер (юниты в скобках)»:
//   total:   первая = отдельные дома + контейнеры (резорт/кондо), в скобках = сдаваемые юниты;
//   houses:  только отдельные дома (без скобок);
//   resorts: контейнеры-резорты (первая) и дома в резорте (в скобках);
//   condos:  контейнеры-кондо (первая) и апартаменты (в скобках).
export function breakdownWithContainers(properties, propsMap, filterFn) {
  let resortContainers = 0;
  let condoContainers  = 0;
  let houses           = 0;
  let resortHouses     = 0;
  let apartments       = 0;

  (properties || []).forEach((p) => {
    if (filterFn && !filterFn(p)) return;
    if (!p.parent_id) {
      if (p.type === 'house')  houses           += 1;
      else if (p.type === 'resort') resortContainers += 1;
      else if (p.type === 'condo')  condoContainers  += 1;
      return;
    }
    const parent = propsMap[p.parent_id];
    if (!parent) return;
    if (parent.type === 'resort' && p.type === 'resort_house')    resortHouses += 1;
    else if (parent.type === 'condo' && p.type === 'condo_apartment') apartments   += 1;
  });

  return {
    total: {
      primary:   houses + resortContainers + condoContainers,
      secondary: houses + resortHouses + apartments,
    },
    houses:  { primary: houses },
    resorts: { primary: resortContainers, secondary: resortHouses },
    condos:  { primary: condoContainers,  secondary: apartments  },
  };
}

export function computeBaseStats({ properties, bookings, user, now = dayjs() }) {
  const isTeamMemberStats = !!(user?.teamMembership);
  const propsMap = buildPropertiesMap(properties);
  const filter = isTeamMemberStats ? (p) => p.responsible_agent_id === user.id : null;
  const bd = breakdownWithContainers(properties, propsMap, filter);

  const endOfMonth = now.endOf('month');
  let myClients = 0;
  let otherClients = 0;
  const bookingsForStats = isTeamMemberStats
    ? (bookings || []).filter((b) => b.responsibleAgentId === user.id)
    : (bookings || []);

  const occupied = bookingsForStats.filter((b) => {
    if (b.notMyCustomer) return false;
    const start = dayjs(b.checkIn);
    const end = dayjs(b.checkOut);
    const isOccupied = now.isAfter(start) && now.isBefore(end);
    if (isOccupied) myClients++;
    return isOccupied;
  }).length;

  const upcomingBookings = bookingsForStats.filter((b) => !b.notMyCustomer && dayjs(b.checkIn).isAfter(now));
  const thisMonth = upcomingBookings.filter((b) => dayjs(b.checkIn).isBefore(endOfMonth)).length;

  return {
    // Каждое поле — { primary, secondary? }; primary = контейнеры+отдельные дома,
    // secondary = сдаваемые юниты внутри. У houses secondary нет (только отдельные дома).
    total:   bd.total,
    houses:  bd.houses,
    resorts: bd.resorts,
    condos:  bd.condos,
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

  const companyBd = breakdownWithContainers(properties, propsMap, null);
  const myBd = breakdownWithContainers(properties, propsMap, (p) => p.responsible_agent_id === user?.id);

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

  return {
    // Каждое поле — { primary, secondary? } (см. комментарий в computeBaseStats).
    companyTotal:   companyBd.total,
    companyHouses:  companyBd.houses,
    companyResorts: companyBd.resorts,
    companyCondos:  companyBd.condos,
    myTotal:   myBd.total,
    myHouses:  myBd.houses,
    myResorts: myBd.resorts,
    myCondos:  myBd.condos,
    companyAgencyActive,
    companyOwnerActive,
    myAgencyActive,
    companyTotalActive: companyAgencyActive + companyOwnerActive,
    companyUpcoming,
    myUpcoming,
    myThisMonth,
    myLater,
  };
}

export function buildCommissionEvents({ bookings, properties }) {
  const out = [];
  (bookings || []).forEach((b) => {
    const events = getCommissionEvents(b);
    if (events.length === 0) return;
    const prop = (properties || []).find((p) => p.id === b.propertyId);
    events.forEach((d) => {
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
