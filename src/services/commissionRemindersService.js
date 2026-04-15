/**
 * Schedules local notifications for owner commission reminders.
 * One notification per date at noon on the event day (0 min = on event day).
 * Uses expo-notifications. Only works on iOS and Android (not web).
 * Supports prorated commission for partial months.
 */
import { Platform } from 'react-native';
import dayjs from 'dayjs';

const NOTIFICATION_CHANNEL_ID = 'commission_reminders';

/**
 * Compute commission dates and amounts (prorated for partial last month).
 * @returns {Array<{date: string, amount: number}>} YYYY-MM-DD and amount
 */
export function getCommissionDateAmounts(checkIn, checkOut, ownerCommissionOneTime, ownerCommissionMonthly) {
  const results = [];
  if (!checkIn || !checkOut) return results;

  const oneTime = ownerCommissionOneTime != null ? Number(ownerCommissionOneTime) : null;
  const monthly = ownerCommissionMonthly != null ? Number(ownerCommissionMonthly) : null;

  if (oneTime != null && oneTime > 0) {
    results.push({ date: dayjs(checkIn).format('YYYY-MM-DD'), amount: oneTime });
  }

  if (monthly != null && monthly > 0) {
    const start = dayjs(checkIn);
    const end = dayjs(checkOut);
    let d = start;

    while (d.isBefore(end)) {
      const dateStr = d.format('YYYY-MM-DD');
      const nextMonth = d.add(1, 'month');

      if (nextMonth.isAfter(end)) {
        const daysInMonth = d.daysInMonth();
        const daysStayed = end.diff(d, 'day');
        const amount = daysStayed > 0 ? Math.round((monthly * daysStayed) / daysInMonth * 100) / 100 : 0;
        if (amount > 0) results.push({ date: dateStr, amount });
      } else {
        results.push({ date: dateStr, amount: monthly });
      }
      d = nextMonth;
    }
  }

  return results;
}

function getNotificationsModule() {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

async function ensureChannel(settings = {}) {
  const Notifications = getNotificationsModule();
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Commission reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: settings.sound !== false ? 'default' : null,
      vibrationPattern: settings.vibration ? [0, 250, 250, 250] : [0],
    });
  } catch {}
}

function identifier(bookingId, dateYMD) {
  return `commission-${bookingId}-${dateYMD}`;
}

/**
 * Schedule reminders for owner commission on each date.
 * @param {string} bookingId - Booking UUID
 * @param {Array<{date: string, amount: number}>} dateAmounts - Dates (YYYY-MM-DD) and amounts (prorated for partial months)
 * @param {string} propertyLabel - Property name or label for display
 * @param {object} settings - User notification settings (sound, vibration)
 */
export async function scheduleCommissionReminders(bookingId, dateAmounts = [], propertyLabel, settings = {}) {
  const Notifications = getNotificationsModule();
  if (!Notifications || !Array.isArray(dateAmounts) || dateAmounts.length === 0) return;

  await ensureChannel(settings);
  const label = propertyLabel || '';

  for (const { date: dateYMD, amount } of dateAmounts) {
    const [y, m, d] = (dateYMD || '').split('-').map(Number);
    const triggerDate = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    if (triggerDate.getTime() <= Date.now()) continue;

    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNEL_ID }),
    };

    const amountStr = amount != null ? String(amount) : '';
    const body = [label, amountStr].filter(Boolean).join(' ') || 'Комиссия от собственника';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Сегодня комиссия от собственника',
        body,
        data: { bookingId, date: dateYMD, type: 'commission_reminder' },
        sound: settings.sound !== false ? true : null,
      },
      trigger,
      identifier: identifier(bookingId, dateYMD),
    });
  }
}

/**
 * Cancel all commission reminders for a booking.
 */
export async function cancelCommissionReminders(bookingId) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const prefix = `commission-${bookingId}-`;
    const ids = (scheduled || [])
      .map((n) => n.identifier)
      .filter((id) => id && id.startsWith(prefix));
    if (ids.length > 0) {
      await Notifications.cancelScheduledNotificationsAsync(ids);
    }
  } catch {}
}
