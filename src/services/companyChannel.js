import { supabase } from './supabase';

// Один приватный канал на компанию. Внутри — отдельные подписки postgres_changes
// по таблицам с фильтром по company_id (для companies — по id). Колбэки приходят
// с raw payload от Supabase: { eventType, new, old, schema, table, commit_timestamp }.
//
// Замена прежнему manual-broadcast паттерну (broadcastChange/broadcastMemberDeactivated/
// broadcastOneShot). Серверные мутации (RPC, edge function) теперь тоже синхронизируются
// автоматически — Postgres сам пишет WAL при любом INSERT/UPDATE/DELETE.

let _channel = null;

const COMPANY_FILTER_TABLES = [
  'properties',
  'bookings',
  'contacts',
  'calendar_events',
  'company_members',
  'company_invitations',
  'agent_location_access',
];

export function initCompanyChannel(companyId, callbacks = {}) {
  if (_channel) {
    supabase.removeChannel(_channel);
    _channel = null;
  }
  if (!companyId) return;

  // private:true для postgres_changes не применяется (см. документацию Supabase
  // Realtime Authorization — это флаг для broadcast/presence). Включение его
  // требовало RLS на realtime.messages, без которых канал не подключался и события
  // не доходили до клиента. Авторизация для postgres_changes идёт через RLS таблиц.
  let channel = supabase.channel(`company-${companyId}`);

  for (const table of COMPANY_FILTER_TABLES) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `company_id=eq.${companyId}` },
      (payload) => {
        const cb = callbacks[table];
        if (typeof cb === 'function') {
          try { cb(payload); } catch (e) { console.warn(`companyChannel ${table} callback failed:`, e); }
        }
      }
    );
  }

  // Таблица companies фильтруется по id (своего company_id у неё нет).
  channel = channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'companies', filter: `id=eq.${companyId}` },
    (payload) => {
      const cb = callbacks.companies;
      if (typeof cb === 'function') {
        try { cb(payload); } catch (e) { console.warn('companyChannel companies callback failed:', e); }
      }
    }
  );

  _channel = channel.subscribe((status, err) => {
    if (__DEV__ && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) {
      console.warn(`[companyChannel] subscribe status: ${status}`, err || '');
    }
  });
}

export function destroyCompanyChannel() {
  if (_channel) {
    supabase.removeChannel(_channel);
    _channel = null;
  }
}
