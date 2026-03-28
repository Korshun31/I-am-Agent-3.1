import { supabase } from './supabase';
import { syncIfEnabled } from './dataUploadService';
import { broadcastChange } from './companyChannel';

/**
 * Таблица calendar_events — ПРОДУКТОВОЕ ИСКЛЮЧЕНИЕ из company-first.
 *
 * Календарь является личным инструментом каждого пользователя.
 * Каждый пользователь (owner или agent) видит и управляет только своими событиями.
 * Это осознанное решение: общекомпанийский календарь не является целевой функцией.
 *
 * RLS (20260327140000_rls_contacts_calendar_events.sql):
 *   - owner : full CRUD через auth_is_company_owner(company_id) — зарезервировано
 *             для будущего admin-overview, сервис это не использует.
 *   - agent : SELECT user_id = auth.uid()
 *             INSERT/UPDATE/DELETE user_id = auth.uid() AND is_company_member
 *
 * JS-фильтры user_id = auth.uid() в read/write методах СООТВЕТСТВУЮТ
 * этой product-модели и НЕ являются legacy-блокерами.
 * Убирать их не нужно до тех пор, пока admin-overview не будет реализован в UI.
 */

async function resolveCompanyId(userId) {
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (company) return company.id;
  // company_members использует agent_id (не user_id), статусного поля нет
  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('agent_id', userId)
    .maybeSingle();
  return member?.company_id ?? null;
}

function normalizeReminderMinutes(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter((n) => typeof n === 'number');
  return typeof val === 'number' ? [val] : [];
}

const REPEAT_TYPES = ['daily', 'weekly', 'monthly', 'yearly'];

function mapEvent(row) {
  const rt = row.repeat_type && REPEAT_TYPES.includes(row.repeat_type) ? row.repeat_type : null;
  return {
    id: row.id,
    eventDate: row.event_date,
    eventTime: row.event_time,
    title: row.title,
    color: row.color,
    comments: row.comments || null,
    isCompleted: !!row.is_completed,
    reminderMinutes: normalizeReminderMinutes(row.reminder_minutes),
    repeatType: rt,
    createdAt: row.created_at,
  };
}

export async function getCalendarEvents() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', session.user.id)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: false })
    .limit(10000);

  if (error) {
    console.error('getCalendarEvents error:', error.message);
    return [];
  }
  return (data || []).map(mapEvent);
}

export async function createCalendarEvent(event) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const rt = event.repeatType && REPEAT_TYPES.includes(event.repeatType) ? event.repeatType : null;
  const row = {
    user_id: session.user.id,
    event_date: event.eventDate,
    event_time: event.eventTime || null,
    title: (event.title || '').trim(),
    color: event.color || '#64B5F6',
    comments: (event.comments || '').trim() || null,
    is_completed: event.isCompleted ?? false,
    reminder_minutes: Array.isArray(event.reminderMinutes) && event.reminderMinutes.length > 0 ? event.reminderMinutes : [],
    repeat_type: rt,
  };
  row.company_id = await resolveCompanyId(session.user.id);

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  broadcastChange('calendar_events');
  return mapEvent(data);
}

export async function updateCalendarEvent(id, event) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const rt = event.repeatType && REPEAT_TYPES.includes(event.repeatType) ? event.repeatType : null;
  const updates = {
    event_date: event.eventDate,
    event_time: event.eventTime || null,
    title: (event.title || '').trim(),
    color: event.color || '#64B5F6',
    comments: (event.comments || '').trim() || null,
    is_completed: event.isCompleted ?? false,
    reminder_minutes: Array.isArray(event.reminderMinutes) && event.reminderMinutes.length > 0 ? event.reminderMinutes : [],
    repeat_type: rt,
  };

  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  broadcastChange('calendar_events');
  return mapEvent(data);
}

export async function deleteCalendarEvent(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) throw new Error(error.message);
  syncIfEnabled();
  broadcastChange('calendar_events');
}

/**
 * Check if a recurring event occurs on the given date.
 * @param {object} event - { eventDate, repeatType }
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {boolean}
 */
export function eventOccursOnDate(event, dateStr) {
  if (!event?.eventDate || !dateStr) return false;
  const startYMD = String(event.eventDate).slice(0, 10);
  if (dateStr < startYMD) return false;
  if (!event.repeatType || !REPEAT_TYPES.includes(event.repeatType)) {
    return dateStr === startYMD;
  }
  const [sy, sm, sd] = startYMD.split('-').map(Number);
  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const startDayOfWeek = new Date(sy, sm - 1, sd).getDay();
  const checkDayOfWeek = new Date(dy, dm - 1, dd).getDay();
  switch (event.repeatType) {
    case 'daily':
      return true;
    case 'weekly':
      return startDayOfWeek === checkDayOfWeek;
    case 'monthly':
      return sd === dd;
    case 'yearly':
      return sm === dm && sd === dd;
    default:
      return dateStr === startYMD;
  }
}
