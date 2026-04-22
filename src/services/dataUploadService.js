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
    // Re-throw so callers (e.g. DataUploadModal) can show the error to the user
    throw e;
  }
}

// Website contract — explicit column whitelists (no SELECT *)
const PROPERTIES_CRM_SELECT = 'id, user_id, company_id, resort_id, type, name, code, code_suffix, city, district, google_maps_link, bedrooms, bathrooms, air_conditioners, beach_distance, market_distance, description, photos, videos, amenities, pets_allowed, long_term_booking, price_monthly, price_monthly_is_from, booking_deposit, save_deposit, commission, electricity_price, water_price, gas_price, exit_cleaning_price, created_at, updated_at';
const BOOKINGS_CRM_SELECT = 'id, user_id, company_id, property_id, check_in, check_out, created_at, updated_at';
const RENTABLE_TYPES = ['house', 'resort_house', 'condo_apartment'];

/**
 * Full sync: push company's properties + bookings to website Supabase.
 * Contract:
 *  - Scope = entire company (filter by company_id, not user_id)
 *  - Only rentable types (no containers: resort, condo)
 *  - Denormalize resort_name + resort_photos from parent for child objects
 *  - DELETE by company_id → INSERT filtered set
 */
async function syncToTarget(targetUrl, serviceRoleKey) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const userId = session.user.id;

  // Resolve company_id for current user via company_members
  const { data: membership, error: memErr } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (memErr) throw new Error(`resolve company: ${memErr.message}`);
  const companyId = membership?.company_id;
  if (!companyId) throw new Error('No active company membership for current user');

  const target = createClient(targetUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 1. Fetch ALL company properties (including containers — needed for denormalization)
  const [allPropsRes, bookRes] = await Promise.all([
    supabase.from('properties').select(PROPERTIES_CRM_SELECT).eq('company_id', companyId).order('name', { ascending: true }),
    supabase.from('bookings').select(BOOKINGS_CRM_SELECT).eq('company_id', companyId),
  ]);
  if (allPropsRes.error) throw new Error(`fetch properties: ${allPropsRes.error.message}`);
  if (bookRes.error) throw new Error(`fetch bookings: ${bookRes.error.message}`);

  const allProperties = allPropsRes.data || [];
  const allBookings = bookRes.data || [];

  // Build parent lookup for denormalization (resort / condo containers)
  const parentsById = new Map();
  for (const p of allProperties) {
    if (p.type === 'resort' || p.type === 'condo') parentsById.set(p.id, p);
  }

  // Filter rentable only + attach resort_name / resort_photos from parent
  const properties = allProperties
    .filter((p) => RENTABLE_TYPES.includes(p.type))
    .map((p) => {
      const parent = p.resort_id ? parentsById.get(p.resort_id) : null;
      return {
        ...p,
        resort_name: parent?.name || null,
        resort_photos: parent?.photos || [],
      };
    });

  // Keep only bookings that reference rentable properties (avoid FK orphans)
  const propertyIds = new Set(properties.map((p) => p.id));
  const bookings = allBookings.filter((b) => propertyIds.has(b.property_id));

  console.log('[DataUpload] Syncing', properties.length, 'properties,', bookings.length, 'bookings for company', companyId);

  // 2. Delete existing company data on target (bookings first — FK on properties)
  const delBook = await target.from('bookings').delete().eq('company_id', companyId);
  if (delBook.error) throw new Error(`delete bookings: ${delBook.error.message}`);
  const delProp = await target.from('properties').delete().eq('company_id', companyId);
  if (delProp.error) throw new Error(`delete properties: ${delProp.error.message}`);

  // 3. Insert properties (top-level first, then children — resort_id is plain UUID on target, no FK)
  if (properties.length > 0) {
    const topLevel = properties.filter((p) => !p.resort_id);
    const children = properties.filter((p) => p.resort_id);
    const ordered = [...topLevel, ...children];
    const { error } = await target.from('properties').insert(ordered);
    if (error) throw new Error(`insert properties: ${error.message}`);
  }
  if (bookings.length > 0) {
    const { error } = await target.from('bookings').insert(bookings);
    if (error) throw new Error(`insert bookings: ${error.message}`);
  }
}
