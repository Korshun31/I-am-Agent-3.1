import dayjs from 'dayjs';
import { computeMonthlyBreakdown } from './bookingPricing';

function getMonths(b) {
  if (Array.isArray(b?.monthlyBreakdown) && b.monthlyBreakdown.length > 0) {
    return b.monthlyBreakdown
      .map((r) => ({ month: r?.month || null, amount: Number(r?.amount) || 0 }))
      .filter((r) => r.month);
  }
  return computeMonthlyBreakdown(b?.checkIn, b?.checkOut, Number(b?.priceMonthly) || 0);
}

export function ownerOneTimeAmount(b) {
  if (!b || b.ownerCommissionOneTime == null) return 0;
  const v = Number(b.ownerCommissionOneTime);
  if (!b.ownerCommissionOneTimeIsPercent) return v;
  const months = getMonths(b);
  const first = months[0]?.amount || 0;
  return Math.round((v / 100) * first);
}

export function ownerMonthlyByMonth(b) {
  if (!b || b.ownerCommissionMonthly == null) return [];
  const v = Number(b.ownerCommissionMonthly);
  if (!(v > 0)) return [];
  const isPercent = !!b.ownerCommissionMonthlyIsPercent;
  return getMonths(b)
    .map((r) => {
      const amount = isPercent ? Math.round((v / 100) * r.amount) : v;
      return { month: r.month, amount };
    })
    .filter((r) => r.amount > 0);
}

export function ownerMonthlyTotalAmount(b) {
  return ownerMonthlyByMonth(b).reduce((s, r) => s + r.amount, 0);
}

export function getCommissionEvents(b) {
  const events = [];
  if (!b?.checkIn) return events;

  const oneTime = ownerOneTimeAmount(b);
  if (oneTime > 0) {
    events.push({
      date: dayjs(b.checkIn).format('YYYY-MM-DD'),
      amount: oneTime,
      type: 'oneTime',
    });
  }

  const months = ownerMonthlyByMonth(b);
  if (months.length > 0) {
    const start = dayjs(b.checkIn);
    months.forEach((r, idx) => {
      const date = start.add(idx, 'month').format('YYYY-MM-DD');
      events.push({ date, amount: r.amount, type: 'monthly', month: r.month });
    });
  }

  return events;
}
