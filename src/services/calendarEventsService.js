import { supabase } from './supabase';

/**
 * Таблица calendar_events в Supabase:
 * CREATE TABLE calendar_events (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   event_date date NOT NULL,
 *   event_time time,
 *   title text NOT NULL,
 *   color text NOT NULL,
 *   comments text,
 *   created_at timestamptz DEFAULT now()
 * );
 * RLS: agent_id = auth.uid()
 */

function mapEvent(row) {
  return {
    id: row.id,
    eventDate: row.event_date,
    eventTime: row.event_time,
    title: row.title,
    color: row.color,
    comments: row.comments || null,
    createdAt: row.created_at,
  };
}

export async function getCalendarEvents() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('agent_id', session.user.id)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('getCalendarEvents error:', error.message);
    return [];
  }
  return (data || []).map(mapEvent);
}

export async function createCalendarEvent(event) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const row = {
    agent_id: session.user.id,
    event_date: event.eventDate,
    event_time: event.eventTime || null,
    title: (event.title || '').trim(),
    color: event.color || '#64B5F6',
    comments: (event.comments || '').trim() || null,
  };

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapEvent(data);
}

export async function updateCalendarEvent(id, event) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const updates = {
    event_date: event.eventDate,
    event_time: event.eventTime || null,
    title: (event.title || '').trim(),
    color: event.color || '#64B5F6',
    comments: (event.comments || '').trim() || null,
  };

  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', id)
    .eq('agent_id', session.user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapEvent(data);
}

export async function deleteCalendarEvent(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .eq('agent_id', session.user.id);

  if (error) throw new Error(error.message);
}
