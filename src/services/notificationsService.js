import { supabase } from './supabase';

export async function getNotifications({ limit = 50, unreadOnly = false } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  let q = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) q = q.eq('is_read', false);

  const { data, error } = await q;
  if (error) { console.warn('[notifications] get error:', error.message); return []; }
  return data || [];
}

export async function getUnreadCount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', session.user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}

export async function markAllRead() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', session.user.id)
    .eq('is_read', false);
}

export async function markActionTaken(notificationId) {
  await supabase
    .from('notifications')
    .update({ action_taken: true, is_read: true })
    .eq('id', notificationId);
}

export async function deleteNotification(notificationId) {
  await supabase.from('notifications').delete().eq('id', notificationId);
}

export async function sendNotification({ recipientId, senderId, type, title, body, propertyId = null }) {
  const { data, error } = await supabase.rpc('create_notification', {
    p_recipient_id: recipientId,
    p_sender_id: senderId,
    p_type: type,
    p_title: title,
    p_body: body || null,
    p_property_id: propertyId || null,
  });
  if (error) console.warn('[notifications] send error:', error.message);
  return data;
}
