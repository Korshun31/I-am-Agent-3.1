import { supabase } from './supabase';

const sessionId = Math.random().toString(36).slice(2);
let _channel = null;
let _companyId = null;

export function initCompanyChannel(companyId, callbacks = {}) {
  if (_channel) supabase.removeChannel(_channel);
  _companyId = companyId;
  if (!companyId) return;
  _channel = supabase
    .channel(`company-${companyId}`)
    .on('broadcast', { event: 'data_changed' }, ({ payload }) => {
      if (payload?.sender_id === sessionId) return;
      const cb = callbacks[payload?.table];
      if (typeof cb === 'function') cb(payload);
    })
    .subscribe();
}

export async function broadcastChange(table) {
  if (!_channel || !_companyId) return;
  await _channel.send({
    type: 'broadcast',
    event: 'data_changed',
    payload: { table, sender_id: sessionId },
  });
}

export async function broadcastMemberDeactivated(userId) {
  if (!_channel || !_companyId) return;
  await _channel.send({
    type: 'broadcast',
    event: 'data_changed',
    payload: { table: 'member_deactivated', target_user_id: userId, sender_id: sessionId },
  });
}

export function destroyCompanyChannel() {
  if (_channel) supabase.removeChannel(_channel);
  _channel = null;
  _companyId = null;
}
