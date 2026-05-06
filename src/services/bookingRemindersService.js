/**
 * Schedules local notifications for booking reminders.
 * Notifications fire at 12:00 (noon) on (checkIn - N days) for each selected N.
 */
import { Platform } from 'react-native';

function getNotificationsModule() {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

const NOTIFICATION_CHANNEL_ID = 'booking_reminders';

async function ensureChannel(settings = {}) {
  const Notifications = getNotificationsModule();
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Booking reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: settings.sound !== false ? 'default' : null,
      vibrationPattern: settings.vibration ? [0, 250, 250, 250] : [0],
    });
  } catch {}
}

function identifier(bookingId, days) {
  return `booking-${bookingId}-${days}`;
}

export async function scheduleBookingReminders(bookingId, checkInYMD, reminderDays, propertyName, settings = {}) {
  const Notifications = getNotificationsModule();
  if (!Notifications || !Array.isArray(reminderDays) || reminderDays.length === 0) return;

  await ensureChannel(settings);
  const [y, m, d] = (checkInYMD || '').split('-').map(Number);
  const checkInDate = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);

  for (const days of reminderDays) {
    const n = parseInt(days, 10);
    if (isNaN(n) || n < 0) continue;
    const triggerDate = new Date(checkInDate);
    triggerDate.setDate(triggerDate.getDate() - n);
    if (triggerDate.getTime() <= Date.now()) continue;

    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNEL_ID }),
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: propertyName || 'Бронирование',
        body: `Напоминание: заезд через ${n} ${n === 1 ? 'день' : n < 5 ? 'дня' : 'дней'}`,
        data: { bookingId, days: n, type: 'booking_reminder' },
        sound: settings.sound !== false ? true : null,
      },
      trigger,
      identifier: identifier(bookingId, n),
    });
  }
}

export async function cancelBookingReminders(bookingId) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  const ids = [1, 3, 7, 30].map((d) => identifier(bookingId, d));
  try {
    await Notifications.cancelScheduledNotificationsAsync(ids);
  } catch {}
}
