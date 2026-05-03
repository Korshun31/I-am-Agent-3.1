import { supabase } from './supabase';

const sessionId = Math.random().toString(36).slice(2);
let _channel = null;
let _companyId = null;
let _callbacks = {};

// Подписка на изменения в компании. Колбэки вызываются:
// — когда сообщение пришло от ДРУГОЙ сессии (другая вкладка/устройство),
// — когда broadcastChange вызван в ЭТОЙ же сессии (локально, чтобы соседние
//   экраны в той же вкладке тоже обновились — Supabase broadcast свой
//   sender_id игнорирует, поэтому без локального эха они застревают на старых данных).
export function initCompanyChannel(companyId, callbacks = {}) {
  if (_channel) supabase.removeChannel(_channel);
  _callbacks = callbacks || {};
  _companyId = companyId;
  if (!companyId) return;
  _channel = supabase
    .channel(`company-${companyId}`)
    .on('broadcast', { event: 'data_changed' }, ({ payload }) => {
      if (payload?.sender_id === sessionId) return; // свои локально дёргаем сами, см. broadcastChange
      const cb = _callbacks[payload?.table];
      if (typeof cb === 'function') cb(payload);
    })
    .subscribe();
}

function emitLocal(payload) {
  const cb = _callbacks?.[payload?.table];
  if (typeof cb === 'function') {
    try { cb(payload); } catch (e) { console.warn('companyChannel local callback failed:', e); }
  }
}

export async function broadcastChange(table) {
  const payload = { table, sender_id: sessionId };
  emitLocal(payload);
  if (!_channel || !_companyId) return;
  await _channel.send({ type: 'broadcast', event: 'data_changed', payload });
}

export async function broadcastMemberDeactivated(userId) {
  const payload = { table: 'member_deactivated', target_user_id: userId, sender_id: sessionId };
  emitLocal(payload);
  if (!_channel || !_companyId) return;
  await _channel.send({ type: 'broadcast', event: 'data_changed', payload });
}

export function broadcastOneShot(companyId, table) {
  return new Promise((resolve) => {
    const ch = supabase.channel(`company-${companyId}`, { config: { broadcast: { self: false } } });
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event: 'data_changed',
          payload: { table, sender_id: sessionId },
        }).then(() => {
          setTimeout(() => {
            supabase.removeChannel(ch);
            resolve();
          }, 500);
        });
      }
    });
  });
}

export function destroyCompanyChannel() {
  if (_channel) supabase.removeChannel(_channel);
  _channel = null;
  _companyId = null;
  _callbacks = {};
}
