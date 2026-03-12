import * as Print from 'expo-print';

const CONF = {
  en: {
    title: 'Booking confirmation',
    confirmationNo: 'Confirmation No',
    dateOfIssue: 'Date of issue',
    sectionProperty: 'Rental property',
    sectionGuest: 'Guest information',
    sectionDates: 'Stay dates',
    sectionFinance: 'Finances',
    sectionCond: 'Terms',
    name: 'Name',
    fullName: 'Name',
    address: 'Address',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    beachDist: 'To beach',
    marketDist: 'To market',
    agentContacts: 'Agent contacts',
    passport: 'Passport',
    contacts: 'Contacts',
    adultsChildren: 'Adults / children',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    period: 'Period',
    rentPerMonth: 'Rent per month',
    rent: 'Rent',
    bookingDeposit: 'Booking deposit',
    saveDeposit: 'Security deposit',
    total: 'Total',
    paid: 'Paid',
    remainder: 'Remainder',
    formula: 'Total = rent for period + security deposit. Booking deposit is included in the first month payment.',
    footnote1: 'Booking deposit guarantees arrival and check-in. If guest does not show, deposit stays with owner. At check-in, deposit counts toward first month — guest pays the difference only.',
    footnote2: 'Security deposit is paid once at check-in. Covers utilities and minor damages. Does not cover major damages. Returned at check-out minus utilities for the last month.',
    condText: 'Pay remainder and security deposit at check-in. Deposit return — after property inspection within 14 days of check-out.',
    guest: 'Guest',
    ownerAgent: 'Owner / Agent',
    footer: 'Document generated automatically. Questions — see contacts above.',
    workingHours: 'Working hours',
    deposit: 'Deposit',
    topUpFirstMonth: 'Top-up for first month',
    paymentMonth: 'Payment for',
    depositReturn: 'Security deposit return',
    meter: 'm',
    day: 'day',
    days: 'days',
    itemLabel: 'Item',
  },
  ru: {
    title: 'Подтверждение бронирования',
    confirmationNo: 'Подтверждение №',
    dateOfIssue: 'Дата выдачи',
    sectionProperty: 'Арендуемый объект недвижимости',
    sectionGuest: 'Информация о клиенте',
    sectionDates: 'Даты проживания',
    sectionFinance: 'Финансы',
    sectionCond: 'Условия',
    name: 'Название',
    fullName: 'ФИО',
    address: 'Адрес',
    bedrooms: 'Спален',
    bathrooms: 'Санузлов',
    beachDist: 'До пляжа',
    marketDist: 'До магазина',
    agentContacts: 'Контакты агента',
    passport: 'Паспорт',
    contacts: 'Контакты',
    adultsChildren: 'Взр. / дети',
    checkIn: 'Заезд',
    checkOut: 'Выезд',
    period: 'Срок',
    rentPerMonth: 'Аренда за месяц',
    rent: 'Аренда',
    bookingDeposit: 'Депозит бронирования',
    saveDeposit: 'Сохранный депозит',
    total: 'Итого',
    paid: 'Оплачено',
    remainder: 'Остаток',
    formula: 'Итого = аренда за период + сохранный депозит. Депозит бронирования входит в оплату первого месяца.',
    footnote1: 'Депозит бронирования гарантирует приезд и заселение клиента. При неявке клиента депозит остаётся у собственника и не возвращается. При заселении депозит засчитывается в оплату первого месяца — клиент доплачивает лишь разницу.',
    footnote2: 'Сохранный депозит вносится однократно при заселении. Является гарантией оплаты коммунальных услуг и возмещения незначительных повреждений. Не покрывает крупные повреждения. Возвращается при выселении за вычетом коммунальных затрат за последний месяц проживания.',
    condText: 'При заезде внести оставшуюся сумму и сохранный депозит. Возврат депозита — после проверки объекта в течение 14 дней с даты выезда.',
    guest: 'Гость',
    ownerAgent: 'Собственник / Агент',
    footer: 'Документ сформирован автоматически. Вопросы — по контактам выше.',
    workingHours: 'Часы работы',
    deposit: 'Депозит',
    topUpFirstMonth: 'Доплата за первый месяц аренды',
    paymentMonth: 'Оплата',
    depositReturn: 'Возврат «Сохранного депозита»',
    meter: 'м',
    day: 'день',
    days: 'дней',
    itemLabel: 'Наименование',
  },
  th: {
    title: 'การยืนยันการจอง',
    confirmationNo: 'หมายเลขยืนยัน',
    dateOfIssue: 'วันที่ออก',
    sectionProperty: 'อสังหาริมทรัพย์ให้เช่า',
    sectionGuest: 'ข้อมูลลูกค้า',
    sectionDates: 'วันที่เข้าพัก',
    sectionFinance: 'การเงิน',
    sectionCond: 'เงื่อนไข',
    name: 'ชื่อ',
    fullName: 'ชื่อ',
    address: 'ที่อยู่',
    bedrooms: 'ห้องนอน',
    bathrooms: 'ห้องน้ำ',
    beachDist: 'ระยะถึงชายหาด',
    marketDist: 'ระยะถึงตลาด',
    agentContacts: 'ติดต่อตัวแทน',
    passport: 'พาสปอร์ต',
    contacts: 'ติดต่อ',
    adultsChildren: 'ผู้ใหญ่ / เด็ก',
    checkIn: 'เช็คอิน',
    checkOut: 'เช็คเอาท์',
    period: 'ระยะเวลา',
    rentPerMonth: 'ค่าเช่าต่อเดือน',
    rent: 'ค่าเช่า',
    bookingDeposit: 'มัดจำการจอง',
    saveDeposit: 'เงินมัดจำ',
    total: 'รวม',
    paid: 'ชำระแล้ว',
    remainder: 'คงเหลือ',
    formula: 'รวม = ค่าเช่าตลอดระยะ + เงินมัดจำ',
    footnote1: 'มัดจำการจองรับประกันการมาถึงและการเช็คอิน',
    footnote2: 'เงินมัดจำชำระครั้งเดียวตอนเช็คอิน',
    condText: 'ชำระยอดคงเหลือและเงินมัดจำที่เช็คอิน',
    guest: 'ลูกค้า',
    ownerAgent: 'เจ้าของ / ตัวแทน',
    footer: 'เอกสารสร้างอัตโนมัติ',
    workingHours: 'ชั่วโมงทำงาน',
    deposit: 'มัดจำ',
    topUpFirstMonth: 'ชำระเพิ่มเดือนแรก',
    paymentMonth: 'ชำระเดือน',
    depositReturn: 'คืนเงินมัดจำ',
    meter: 'ม',
    day: 'วัน',
    days: 'วัน',
    itemLabel: 'รายการ',
  },
};

const ORD = {
  en: (n) => (n === 2 ? '2nd' : n === 3 ? '3rd' : n === 4 ? '4th' : `${n}th`),
  ru: (n) => (n === 2 ? 'второго' : n === 3 ? 'третьего' : n === 4 ? 'четвёртого' : `${n}-го`),
  th: (n) => `ที่ ${n}`,
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${day}.${m}.${y}`;
}

function formatPrice(val) {
  if (val == null) return '—';
  return Number(val).toLocaleString('en-US').replace(/,/g, ' ');
}

function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  const ms = end - start;
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function pluralDays(n, lang = 'ru') {
  const s = CONF[lang] || CONF.ru;
  if (lang === 'en') return n === 1 ? `${n} ${s.day}` : `${n} ${s.days}`;
  if (lang === 'th') return `${n} ${s.days}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${s.days}`;
  if (mod10 === 1) return `${n} ${s.day}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} ${s.days}`;
}

function addMonth(d, n = 1) {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

/** Resort: line1=resort name, line2=house+code. Standalone: single line. Returns HTML string. */
function buildPropertyDisplayNameHtml(prop) {
  if (!prop) return '—';
  if (prop._resort) {
    const resortName = (prop._resort.name || prop._resort.code || '').trim();
    const unitParts = [prop.name, prop.code].filter(Boolean);
    if (prop.code_suffix) unitParts.push(`(${prop.code_suffix})`);
    const unitName = unitParts.join(' ').trim() || '—';
    return resortName ? `${escapeHtml(resortName)}<br>${escapeHtml(unitName)}` : escapeHtml(unitName);
  }
  const parts = [prop.name, prop.code].filter(Boolean);
  if (prop.code_suffix) parts.push(`(${prop.code_suffix})`);
  return escapeHtml(parts.join(' ') || '—');
}

function buildPaymentPlanRows(b, lang = 'ru') {
  const s = CONF[lang] || CONF.ru;
  const ord = ORD[lang] || ORD.ru;
  const rows = [];
  const pm = Number(b.priceMonthly) || 0;
  const bd = Number(b.bookingDeposit) || 0;
  const sd = Number(b.saveDeposit) || 0;
  const dateOfIssue = b.dateOfIssue;
  const checkIn = new Date(b.checkIn);
  const checkOut = new Date(b.checkOut);

  if (!b.checkIn || !b.checkOut || pm <= 0) return rows;

  rows.push({ date: dateOfIssue, description: `«${s.bookingDeposit}»`, amount: formatPrice(bd) });

  let periodStart = new Date(checkIn);
  let monthNum = 1;

  while (periodStart < checkOut) {
    const periodEnd = addMonth(periodStart);
    const realEnd = periodEnd > checkOut ? checkOut : periodEnd;
    const startStr = formatDate(periodStart);
    const endStr = formatDate(realEnd);
    const daysInPeriod = Math.round((realEnd - periodStart) / (24 * 60 * 60 * 1000));
    const daysInFullMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
    const rentForPeriod = Math.round((pm / daysInFullMonth) * daysInPeriod);

    const paymentDate = formatDate(periodStart);
    if (monthNum === 1) {
      const doplata = Math.max(0, rentForPeriod - bd);
      if (doplata > 0) {
        rows.push({ date: paymentDate, description: `${s.topUpFirstMonth} (${startStr} - ${endStr})`, amount: formatPrice(doplata) });
      }
      rows.push({ date: paymentDate, description: `«${s.saveDeposit}»`, amount: formatPrice(sd) });
    } else {
      const ordStr = ord(monthNum);
      const desc = lang === 'en' ? `${s.paymentMonth} ${ordStr} month (${startStr} - ${endStr})` : lang === 'th' ? `${s.paymentMonth} ${ordStr} (${startStr} - ${endStr})` : `Оплата ${ordStr} месяца (${startStr} - ${endStr})`;
      rows.push({ date: paymentDate, description: desc, amount: formatPrice(rentForPeriod) });
    }

    monthNum++;
    periodStart = realEnd;
  }

  const returnDate = formatDate(checkOut);
  rows.push({ date: returnDate, description: s.depositReturn, amount: formatPrice(sd) });

  return rows;
}

/**
 * Build HTML for booking confirmation.
 * @param {Object} params
 * @param {Object} params.booking - booking data
 * @param {Object} params.property - property with name, address
 * @param {Object} params.contact - contact (guest)
 * @param {Object} params.profile - agent profile (name, lastName, phone, telegram, email, workAs, companyInfo)
 * @param {string} params.confirmationNumber - e.g. "5/25"
 */
export function buildConfirmationHTML({ booking, property, contact, profile, confirmationNumber, language }) {
  const lang = language && CONF[language] ? language : 'ru';
  const s = CONF[lang];

  const b = booking || {};
  const prop = property || {};
  const c = contact || {};
  const p = profile || {};

  const propertyNameHtml = buildPropertyDisplayNameHtml(prop);
  const propertyAddress = prop.address || prop._resort?.address || '—';
  const bedrooms = prop.bedrooms ?? prop._resort?.bedrooms;
  const bathrooms = prop.bathrooms ?? prop._resort?.bathrooms;
  const beachDistance = prop.beach_distance ?? prop._resort?.beach_distance;
  const marketDistance = prop.market_distance ?? prop._resort?.market_distance;

  const guestName = [c.name, c.lastName].filter(Boolean).join(' ').trim() || '—';
  const guestPassport = b.passportId || c.documentNumber || '—';
  const guestContacts = [c.phone, c.email].filter(Boolean).join(', ') || '—';
  const adults = b.adults ?? c.adults ?? '—';
  const children = b.children ?? c.children ?? '—';

  const checkInDate = formatDate(b.checkIn);
  const checkOutDate = formatDate(b.checkOut);
  const checkInTime = b.checkInTime || '';
  const checkOutTime = b.checkOutTime || '';
  const checkInFull = checkInTime ? `${checkInDate}, ${checkInTime}` : checkInDate;
  const checkOutFull = checkOutTime ? `${checkOutDate}, ${checkOutTime}` : checkOutDate;
  const totalDays = daysBetween(b.checkIn, b.checkOut);
  const periodStr = `${checkInDate} – ${checkOutDate} (${pluralDays(totalDays, lang)})`;

  const priceMonthly = b.priceMonthly ?? prop.price_monthly;
  const totalPrice = b.totalPrice;
  const bookingDeposit = b.bookingDeposit ?? prop.booking_deposit;
  const saveDeposit = b.saveDeposit ?? prop.save_deposit;

  const total = (Number(totalPrice) || 0) + (Number(saveDeposit) || 0);
  const paid = Number(bookingDeposit) || 0;
  const remainder = total - paid;

  const isCompany = p.workAs === 'company' && p.companyInfo && typeof p.companyInfo === 'object';
  const ci = p.companyInfo || {};
  const companyName = isCompany && ci.name
    ? ci.name.trim()
    : [p.name, p.lastName].filter(Boolean).join(' ').trim() || 'I am Agent';
  const companyAddrLines = isCompany
    ? (() => {
        const lines = [];
        const ph = (ci.phone || '').trim();
        if (ph) lines.push(ph);
        const em = (ci.email || '').trim();
        if (em) lines.push(em);
        const tg = (ci.telegram || '').trim();
        if (tg) lines.push('Telegram: ' + tg);
        const ig = (ci.instagram || '').trim();
        if (ig) lines.push('Instagram: ' + ig);
        const wh = (ci.workingHours || '').trim();
        if (wh) lines.push(s.workingHours + ': ' + wh);
        return lines;
      })()
    : [];
  const companyAddrHtml = isCompany
    ? companyAddrLines.map((s) => escapeHtml(s)).join('<br>')
    : [p.telegram && `Telegram: ${p.telegram}`, p.email && `Email: ${p.email}`, p.phone && `Tel: ${p.phone}`]
        .filter(Boolean)
        .join(' • ') || '';
  const logoHtml = isCompany && ci.logoUrl
    ? `<img src="${escapeHtml(ci.logoUrl)}" alt="" style="width:144px;height:48px;object-fit:contain;max-width:144px;max-height:48px" />`
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 48" width="48" height="48"><rect x="2" y="8" width="12" height="32" rx="3" fill="#D87A5C" transform="rotate(-8 8 24)"/><rect x="18" y="6" width="12" height="32" rx="3" fill="#E5B84A" transform="rotate(-4 24 22)"/><rect x="34" y="4" width="12" height="32" rx="3" fill="#8BA882" transform="rotate(0 40 20)"/><rect x="50" y="6" width="12" height="32" rx="3" fill="#5BA3A8" transform="rotate(4 56 22)"/><rect x="66" y="8" width="12" height="32" rx="3" fill="#3D7D82" transform="rotate(8 72 24)"/></svg>';

  const dateOfIssue = formatDate(b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const paymentPlanRows = buildPaymentPlanRows({
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    priceMonthly,
    totalPrice,
    bookingDeposit,
    saveDeposit,
    dateOfIssue,
  }, lang);

  const paymentPlanTableBody = paymentPlanRows
    .map((r) => `<tr><td class="payment-date">${r.date}</td><td>${escapeHtml(r.description)}</td><td class="payment-amount">${r.amount} Thb</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(s.title)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 14mm; }
    :root { --bg: #F5F2EB; --card: #FFFFFF; --title: #2C2C2C; --subtitle: #5A5A5A; --label: #8A8A8A; --accent: #5DB8D4; --border: #E0DAD2; --block-blue: rgba(187,222,251,0.5); --block-blue-border: #64B5F6; --block-yellow: rgba(255,204,0,0.2); --block-yellow-border: #FFCC00; --block-green: rgba(168,230,163,0.35); --block-green-border: #A8E6A3; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--title); background: var(--bg); padding: 16px; margin: 0; font-size: 13px; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: var(--card); padding: 18px 24px; }
    .header { padding-bottom: 6px; border-bottom: 2px solid var(--accent); }
    .header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .logo { width: 144px; min-width: 144px; height: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .logo svg { display: block; max-width: 100%; max-height: 100%; }
    .logo img { display: block; max-width: 144px; max-height: 48px; object-fit: contain; }
    .company { flex: 1; min-width: 0; text-align: right; }
    .company-name { font-size: 12px; font-weight: 700; color: var(--title); margin-bottom: 2px; }
    .company-addr { font-size: 7px; color: var(--subtitle); line-height: 1.25; }
    .header-below { margin-top: 10px; margin-bottom: 4px; }
    .confirmation-id { font-size: 10px; color: var(--subtitle); text-align: left; }
    .confirmation-id strong { color: var(--title); }
    h1 { font-size: 16px; margin: 12px 0 10px; color: var(--title); }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; align-items: stretch; }
    .left-col { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
    .left-col .section { margin-bottom: 0; flex: 1; display: flex; flex-direction: column; }
    .section { margin-bottom: 10px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); }
    .section.obj { background: rgba(255,183,77,0.35); border-color: #FFB74D; }
    .section.guest { background: var(--block-yellow); border-color: var(--block-yellow-border); }
    .section.dates { background: var(--block-green); border-color: var(--block-green-border); }
    .section.finance { background: var(--block-blue); border-color: var(--block-blue-border); display: flex; flex-direction: column; align-self: stretch; margin-bottom: 0; }
    .section.finance .footnotes { margin-top: auto; }
    .section.cond { background: rgba(248,187,208,0.3); border-color: #F48FB1; }
    .grid-2 + .section { margin-top: 12px; }
    .section-title { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--title); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }
    table.info { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.info td { padding: 3px 0; vertical-align: top; }
    table.info td:first-child { color: var(--title); width: 90px; }
    table.info td.bold { font-weight: 700; }
    .finance-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .finance-table th, .finance-table td { padding: 5px 10px; text-align: left; border-bottom: 1px solid var(--border); }
    .finance-table th { background: var(--block-blue); font-weight: 700; color: var(--title); font-size: 11px; }
    .finance-table .number { text-align: right; }
    .finance-table .total { font-weight: 700; background: var(--block-blue); }
    .formula { font-size: 10px; color: var(--label); font-style: italic; margin-top: 2px; }
    .payment-plan-table { margin-top: 10px; width: 100%; border-collapse: collapse; font-size: 11px; color: var(--subtitle); border: none; }
    .payment-plan-table td { padding: 4px 8px; border: none; vertical-align: top; }
    .payment-plan-table .payment-date { font-weight: 700; color: var(--title); white-space: nowrap; width: 1%; }
    .payment-plan-table .payment-amount { text-align: right; white-space: nowrap; width: 1%; }
    .footnotes { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 10px; color: var(--subtitle); line-height: 1.4; }
    .footnotes p { margin: 0 0 6px 0; }
    .footnotes sup { color: var(--accent); font-weight: 600; }
    .conditions { font-size: 11px; color: var(--subtitle); line-height: 1.4; margin: 0; }
    .signatures { display: flex; gap: 40px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
    .sig-block { flex: 1; }
    .sig-line { border-bottom: 1px solid var(--title); height: 28px; margin-bottom: 2px; }
    .sig-label { font-size: 10px; color: var(--label); }
    .footer { margin-top: 10px; font-size: 10px; color: var(--label); line-height: 1.4; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-top">
        <div class="logo">${logoHtml}</div>
        <div class="company">
          <div class="company-name">${escapeHtml(companyName)}</div>
          <div class="company-addr">${companyAddrHtml}</div>
        </div>
      </div>
    </div>
    <div class="header-below">
      <div class="confirmation-id">
        <div>${s.confirmationNo} <strong>${escapeHtml(confirmationNumber || '—')}</strong></div>
        <div>${s.dateOfIssue}: ${dateOfIssue}</div>
      </div>
    </div>
    <h1>${escapeHtml(s.title)}</h1>
    <div class="grid-2">
      <div class="left-col">
        <div class="section obj">
          <div class="section-title">${s.sectionProperty}</div>
          <table class="info">
            <tr><td>${s.name}</td><td class="bold">${propertyNameHtml}</td></tr>
            <tr><td>${s.address}</td><td>${escapeHtml(propertyAddress)}</td></tr>
            <tr><td>${s.bedrooms}</td><td>${bedrooms != null ? bedrooms : '—'}</td></tr>
            <tr><td>${s.bathrooms}</td><td>${bathrooms != null ? bathrooms : '—'}</td></tr>
            <tr><td>${s.beachDist}</td><td>${beachDistance != null ? `${beachDistance} ${s.meter}` : '—'}</td></tr>
            <tr><td>${s.marketDist}</td><td>${marketDistance != null ? `${marketDistance} ${s.meter}` : '—'}</td></tr>
            <tr><td>${s.agentContacts}</td><td>${(isCompany ? ci.phone : p.phone) ? escapeHtml(isCompany ? ci.phone : p.phone) : '—'}</td></tr>
          </table>
        </div>
        <div class="section guest">
          <div class="section-title">${s.sectionGuest}</div>
          <table class="info">
            <tr><td>${s.fullName}</td><td class="bold">${escapeHtml(guestName)}</td></tr>
            <tr><td>${s.passport}</td><td>${escapeHtml(guestPassport)}</td></tr>
            <tr><td>${s.contacts}</td><td>${escapeHtml(guestContacts)}</td></tr>
            <tr><td>${s.adultsChildren}</td><td>${adults} / ${children}</td></tr>
          </table>
        </div>
        <div class="section dates">
          <div class="section-title">${s.sectionDates}</div>
          <table class="info">
            <tr><td>${s.checkIn}</td><td>${escapeHtml(checkInFull)}</td></tr>
            <tr><td>${s.checkOut}</td><td>${escapeHtml(checkOutFull)}</td></tr>
            <tr><td>${s.period}</td><td>${escapeHtml(periodStr)}</td></tr>
          </table>
        </div>
      </div>
      <div class="section finance">
        <div class="section-title">${s.sectionFinance}</div>
        <table class="finance-table">
          <tr><th>${s.itemLabel || s.name}</th><th class="number">Thb</th></tr>
          <tr><td>${s.rentPerMonth}</td><td class="number">${formatPrice(priceMonthly)}</td></tr>
          <tr><td>${s.rent} (${checkInDate} – ${checkOutDate})</td><td class="number">${formatPrice(totalPrice)}</td></tr>
          <tr><td>${s.bookingDeposit}<sup>1</sup></td><td class="number">${formatPrice(bookingDeposit)}</td></tr>
          <tr><td>${s.saveDeposit}<sup>2</sup></td><td class="number">${formatPrice(saveDeposit)}</td></tr>
          <tr class="total"><td>${s.total}</td><td class="number">${formatPrice(total)}</td></tr>
          <tr><td>${s.paid}</td><td class="number">${formatPrice(paid)}</td></tr>
          <tr class="total"><td>${s.remainder}</td><td class="number">${formatPrice(remainder)}</td></tr>
        </table>
        <div class="formula">${s.formula}</div>
        <table class="payment-plan-table"><tbody>${paymentPlanTableBody}</tbody></table>
        <div class="footnotes">
          <p><sup>1</sup> ${s.footnote1}</p>
          <p><sup>2</sup> ${s.footnote2}</p>
        </div>
      </div>
    </div>
    <div class="section cond">
      <div class="section-title">${s.sectionCond}</div>
      <p class="conditions">${s.condText}</p>
    </div>
    <div class="signatures">
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">${s.guest}</div></div>
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">${s.ownerAgent}</div></div>
    </div>
    <div class="footer">${s.footer}</div>
  </div>
</body>
</html>`;

  return html;
}

function escapeHtml(s) {
  if (s == null) return '';
  const str = String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate PDF.
 * @returns {Promise<{ uri: string, html: string }>}
 */
export async function generateConfirmationPDF(params) {
  const html = buildConfirmationHTML(params);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  return { uri, html };
}
