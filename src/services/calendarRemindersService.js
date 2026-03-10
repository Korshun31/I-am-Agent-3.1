/**
 * Service for scheduling local notifications for calendar event reminders.
 * Uses expo-notifications. Only works on iOS and Android (not web).
 */
import { Platform } from 'react-native';

const NOTIFICATION_CHANNEL_ID = 'calendar_reminders';

async function getNotificationsModule() {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

export async function requestReminderPermissions() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function ensureChannel(settings = {}) {
  const Notifications = await getNotificationsModule();
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Calendar reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: settings.sound !== false ? 'default' : null,
      vibrationPattern: settings.vibration ? [0, 250, 250, 250] : [0],
    });
  } catch {}
}

/**
 * Schedule a local notification for a calendar event reminder.
 * @param {string} eventId - Event UUID (used as notification identifier for cancellation)
 * @param {string} eventDate - "YYYY-MM-DD"
 * @param {string|null} eventTime - "HH:mm" or "HH:mm:ss"
 * @param {number} reminderMinutes - Minutes before event (0 = at event time)
 * @param {string} title - Event title
 * @param {object} settings - User notification settings (sound, vibration)
 */
export async function scheduleReminder(eventId, eventDate, eventTime, reminderMinutes, title, settings = {}) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const dateStr = eventDate || '';
  const timeStr = eventTime || '12:00';
  const parts = String(timeStr).split(':');
  const hours = parseInt(parts[0] || '12', 10);
  const minutes = parseInt(parts[1] || '0', 10);

  const [y, m, d] = dateStr.split('-').map(Number);
  const eventDateObj = new Date(y, (m || 1) - 1, d || 1, hours, minutes, 0, 0);
  const triggerDate = new Date(eventDateObj.getTime() - (reminderMinutes || 0) * 60 * 1000);

  if (triggerDate.getTime() <= Date.now()) return;

  await ensureChannel(settings);

  const trigger = Platform.OS === 'android'
    ? { date: triggerDate, channelId: NOTIFICATION_CHANNEL_ID }
    : triggerDate;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: title || 'Напоминание',
      body: `${dateStr} ${timeStr}`,
      data: { eventId, type: 'calendar_reminder' },
      sound: settings.sound !== false ? true : null,
    },
    trigger,
    identifier: eventId,
  });
}

export async function cancelReminder(eventId) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(eventId);
  } catch {}
}
