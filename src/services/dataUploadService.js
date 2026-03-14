import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

const STORAGE_KEY = 'data_upload_config';

// Fallback when AsyncStorage native module fails (web, some Expo builds)
let memoryFallback = null;

async function storageGet() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryFallback;
  }
}

async function storageSet(value) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch (_) {}
  memoryFallback = value;
}

async function storageRemove() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
  memoryFallback = null;
}

/**
 * Get stored upload config. Returns { url, serviceRoleKey, enabled } or null.
 */
export async function getUploadConfig() {
  try {
    const raw = await storageGet();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save config and set enabled. Called when user starts upload.
 */
export async function startUpload(url, serviceRoleKey) {
  const trimmedUrl = (url || '').trim().replace(/\/+$/, '');
  const trimmedKey = (serviceRoleKey || '').trim();
  if (!trimmedUrl || !trimmedKey) throw new Error('URL and Service Role Key are required');

  await storageSet(
    JSON.stringify({ url: trimmedUrl, serviceRoleKey: trimmedKey, enabled: true })
  );
}

/**
 * Clear config and disable. Called when user stops upload.
 */
export async function stopUpload() {
  await storageRemove();
}

/**
 * Check if upload is enabled. If so, trigger sync.
 * Call this after any data mutation (create/update/delete).
 */
export async function syncIfEnabled() {
  const config = await getUploadConfig();
  if (!config?.enabled || !config?.url || !config?.serviceRoleKey) return;

  try {
    await syncToTarget(config.url, config.serviceRoleKey);
  } catch (e) {
    console.error('[DataUpload] Sync failed:', e?.message || e);
  }
}

/**
 * Full sync: fetch all user data from our Supabase, push to target.
 */
async function syncToTarget(targetUrl, serviceRoleKey) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const agentId = session.user.id;
  const target = createClient(targetUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 1. Fetch from our DB (raw rows for insert)
  const [locRes, contactRes, propRes, bookRes, eventRes] = await Promise.all([
    supabase.from('locations').select('*').eq('agent_id', agentId).order('created_at', { ascending: true }),
    supabase.from('contacts').select('*').eq('agent_id', agentId),
    supabase.from('properties').select('*').eq('agent_id', agentId).order('name', { ascending: true }),
    supabase.from('bookings').select('*').eq('agent_id', agentId),
    supabase.from('calendar_events').select('*').eq('agent_id', agentId),
  ]);

  const locations = locRes.data || [];
  const contacts = contactRes.data || [];
  const properties = propRes.data || [];
  const bookings = bookRes.data || [];
  const calendarEvents = eventRes.data || [];

  const locationIds = locations.map((l) => l.id);

  let districts = [];
  if (locationIds.length > 0) {
    const distRes = await supabase
      .from('location_districts')
      .select('*')
      .in('location_id', locationIds);
    districts = distRes.data || [];
  }

  // 2. Delete existing agent data on target (reverse FK order)
  await target.from('bookings').delete().eq('agent_id', agentId);
  await target.from('calendar_events').delete().eq('agent_id', agentId);
  await target.from('properties').delete().eq('agent_id', agentId);
  await target.from('contacts').delete().eq('agent_id', agentId);
  if (locationIds.length > 0) {
    await target.from('location_districts').delete().in('location_id', locationIds);
  }
  await target.from('locations').delete().eq('agent_id', agentId);

  // 3. Insert in FK order
  if (locations.length > 0) {
    const { error } = await target.from('locations').insert(locations);
    if (error) throw new Error(`locations: ${error.message}`);
  }
  if (districts.length > 0) {
    const { error } = await target.from('location_districts').insert(districts);
    if (error) throw new Error(`location_districts: ${error.message}`);
  }
  if (contacts.length > 0) {
    const { error } = await target.from('contacts').insert(contacts);
    if (error) throw new Error(`contacts: ${error.message}`);
  }
  if (properties.length > 0) {
    const topLevel = properties.filter((p) => !p.resort_id);
    const children = properties.filter((p) => p.resort_id);
    const ordered = [...topLevel, ...children];
    const { error } = await target.from('properties').insert(ordered);
    if (error) throw new Error(`properties: ${error.message}`);
  }
  if (bookings.length > 0) {
    const { error } = await target.from('bookings').insert(bookings);
    if (error) throw new Error(`bookings: ${error.message}`);
  }
  if (calendarEvents.length > 0) {
    const { error } = await target.from('calendar_events').insert(calendarEvents);
    if (error) throw new Error(`calendar_events: ${error.message}`);
  }
}
