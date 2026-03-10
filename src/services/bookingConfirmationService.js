import * as Print from 'expo-print';

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

function pluralDays(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
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

function buildPaymentPlanRows(b) {
  const rows = [];
  const pm = Number(b.priceMonthly) || 0;
  const bd = Number(b.bookingDeposit) || 0;
  const sd = Number(b.saveDeposit) || 0;
  const dateOfIssue = b.dateOfIssue;
  const checkIn = new Date(b.checkIn);
  const checkOut = new Date(b.checkOut);

  if (!b.checkIn || !b.checkOut || pm <= 0) return rows;

  rows.push({ date: dateOfIssue, description: '«Депозит бронирования»', amount: formatPrice(bd) });

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
        rows.push({ date: paymentDate, description: `Доплата за первый месяц аренды (${startStr} - ${endStr})`, amount: formatPrice(doplata) });
      }
      rows.push({ date: paymentDate, description: '«Сохранный депозит»', amount: formatPrice(sd) });
    } else {
      const ord = monthNum === 2 ? 'второго' : monthNum === 3 ? 'третьего' : monthNum === 4 ? 'четвёртого' : `${monthNum}-го`;
      rows.push({ date: paymentDate, description: `Оплата ${ord} месяца (${startStr} - ${endStr})`, amount: formatPrice(rentForPeriod) });
    }

    monthNum++;
    periodStart = realEnd;
  }

  const returnDate = formatDate(checkOut);
  rows.push({ date: returnDate, description: 'Возврат «Сохранного депозита»', amount: formatPrice(sd) });

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
export function buildConfirmationHTML({ booking, property, contact, profile, confirmationNumber }) {
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
  const periodStr = `${checkInDate} – ${checkOutDate} (${pluralDays(totalDays)})`;

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
        if (wh) lines.push('Часы работы: ' + wh);
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

  const dateOfIssue = formatDate(new Date().toISOString().slice(0, 10));
  const paymentPlanRows = buildPaymentPlanRows({
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    priceMonthly,
    totalPrice,
    bookingDeposit,
    saveDeposit,
    dateOfIssue,
  });

  const paymentPlanTableBody = paymentPlanRows
    .map((r) => `<tr><td class="payment-date">${r.date}</td><td>${escapeHtml(r.description)}</td><td class="payment-amount">${r.amount} Thb</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подтверждение бронирования</title>
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
        <div>Подтверждение № <strong>${escapeHtml(confirmationNumber || '—')}</strong></div>
        <div>Дата выдачи: ${dateOfIssue}</div>
      </div>
    </div>
    <h1>Подтверждение бронирования</h1>
    <div class="grid-2">
      <div class="left-col">
        <div class="section obj">
          <div class="section-title">Арендуемый объект недвижимости</div>
          <table class="info">
            <tr><td>Название</td><td class="bold">${propertyNameHtml}</td></tr>
            <tr><td>Адрес</td><td>${escapeHtml(propertyAddress)}</td></tr>
            <tr><td>Спален</td><td>${bedrooms != null ? bedrooms : '—'}</td></tr>
            <tr><td>Санузлов</td><td>${bathrooms != null ? bathrooms : '—'}</td></tr>
            <tr><td>До пляжа</td><td>${beachDistance != null ? `${beachDistance} м` : '—'}</td></tr>
            <tr><td>До магазина</td><td>${marketDistance != null ? `${marketDistance} м` : '—'}</td></tr>
            <tr><td>Контакты агента</td><td>${(isCompany ? ci.phone : p.phone) ? escapeHtml(isCompany ? ci.phone : p.phone) : '—'}</td></tr>
          </table>
        </div>
        <div class="section guest">
          <div class="section-title">Информация о клиенте</div>
          <table class="info">
            <tr><td>ФИО</td><td class="bold">${escapeHtml(guestName)}</td></tr>
            <tr><td>Паспорт</td><td>${escapeHtml(guestPassport)}</td></tr>
            <tr><td>Контакты</td><td>${escapeHtml(guestContacts)}</td></tr>
            <tr><td>Взр. / дети</td><td>${adults} / ${children}</td></tr>
          </table>
        </div>
        <div class="section dates">
          <div class="section-title">Даты проживания</div>
          <table class="info">
            <tr><td>Заезд</td><td>${escapeHtml(checkInFull)}</td></tr>
            <tr><td>Выезд</td><td>${escapeHtml(checkOutFull)}</td></tr>
            <tr><td>Срок</td><td>${escapeHtml(periodStr)}</td></tr>
          </table>
        </div>
      </div>
      <div class="section finance">
        <div class="section-title">Финансы</div>
        <table class="finance-table">
          <tr><th>Наименование</th><th class="number">Thb</th></tr>
          <tr><td>Аренда за месяц</td><td class="number">${formatPrice(priceMonthly)}</td></tr>
          <tr><td>Аренда (${checkInDate} – ${checkOutDate})</td><td class="number">${formatPrice(totalPrice)}</td></tr>
          <tr><td>Депозит бронирования<sup>1</sup></td><td class="number">${formatPrice(bookingDeposit)}</td></tr>
          <tr><td>Сохранный депозит<sup>2</sup></td><td class="number">${formatPrice(saveDeposit)}</td></tr>
          <tr class="total"><td>Итого</td><td class="number">${formatPrice(total)}</td></tr>
          <tr><td>Оплачено</td><td class="number">${formatPrice(paid)}</td></tr>
          <tr class="total"><td>Остаток</td><td class="number">${formatPrice(remainder)}</td></tr>
        </table>
        <div class="formula">Итого = аренда за период + сохранный депозит. Депозит бронирования входит в оплату первого месяца.</div>
        <table class="payment-plan-table"><tbody>${paymentPlanTableBody}</tbody></table>
        <div class="footnotes">
          <p><sup>1</sup> Депозит бронирования гарантирует приезд и заселение клиента. При неявке клиента депозит остаётся у собственника и не возвращается. При заселении депозит засчитывается в оплату первого месяца — клиент доплачивает лишь разницу.</p>
          <p><sup>2</sup> Сохранный депозит вносится однократно при заселении. Является гарантией оплаты коммунальных услуг и возмещения незначительных повреждений. Не покрывает крупные повреждения. Возвращается при выселении за вычетом коммунальных затрат за последний месяц проживания.</p>
        </div>
      </div>
    </div>
    <div class="section cond">
      <div class="section-title">Условия</div>
      <p class="conditions">При заезде внести оставшуюся сумму и сохранный депозит. Возврат депозита — после проверки объекта в течение 14 дней с даты выезда.</p>
    </div>
    <div class="signatures">
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Гость</div></div>
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Собственник / Агент</div></div>
    </div>
    <div class="footer">Документ сформирован автоматически. Вопросы — по контактам выше.</div>
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
 * Generate PDF and optionally share.
 * @returns {Promise<{ uri: string }>}
 */
export async function generateConfirmationPDF(params) {
  const html = buildConfirmationHTML(params);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  return { uri };
}
