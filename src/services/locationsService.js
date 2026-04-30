import { supabase } from './supabase';
import { syncIfEnabled } from './dataUploadService';
import { updatePropertiesDistrictForLocation } from './propertiesService';

async function resolveCompanyId(userId) {
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (company) return company.id;
  const { data: member, error: memberErr } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (memberErr) {
    console.warn('[locationsService] resolveCompanyId member query error:', memberErr.message);
    return null;
  }
  return member?.company_id ?? null;
}

export async function getLocations() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  // Без фильтра user_id — RLS определяет scope:
  //   owner   → все его locations (user_id = auth.uid())
  //   agent   → только назначенные через agent_location_access
  // Фильтр user_id = session.user.id блокировал агентов от видимости назначенных локаций.
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getLocations error:', error.message);
    return [];
  }

  return (data || []).map(mapLocation);
}

export async function createLocation({ country, region, city }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('locations')
    .insert({
      user_id: session.user.id,
      company_id: await resolveCompanyId(session.user.id),
      country: country || '',
      region: region || '',
      city: city || '',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return mapLocation(data);
}

export async function updateLocation(id, { country, region, city }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const updates = {};
  if (country !== undefined) updates.country = country;
  if (region !== undefined) updates.region = region;
  if (city !== undefined) updates.city = city;

  // Без фильтра user_id — RLS "locations: owner full access" (user_id = auth.uid())
  // обеспечивает ту же защиту: owner может обновлять только свои локации,
  // агент не пройдёт RLS (у него нет UPDATE-политики).
  const { data, error } = await supabase
    .from('locations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return mapLocation(data);
}

export async function deleteLocation(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  // Без фильтра user_id — RLS "locations: owner full access" обеспечивает защиту.
  // Агент не пройдёт RLS (нет DELETE-политики для агентов).
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  syncIfEnabled();
}

export async function getLocationDistricts(locationId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('location_districts')
    .select('id, district')
    .eq('location_id', locationId)
    .order('district', { ascending: true });

  if (error) return [];
  return (data || []).map((r) => r.district);
}

/**
 * Атомарно добавить один район в локацию. Безопасно при одновременных вызовах
 * нескольких пользователей: INSERT ... ON CONFLICT DO NOTHING полагается на
 * UNIQUE(location_id, district) constraint в БД (миграция 20250101000001).
 * В отличие от setLocationDistricts (delete-then-insert), здесь нет race
 * condition — два параллельных вызова с разными district просто оба пройдут.
 */
export async function addLocationDistrict(locationId, district) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const trimmed = (district || '').trim();
  if (!locationId || !trimmed) throw new Error('locationId and district are required');

  const { error } = await supabase
    .from('location_districts')
    .insert({ location_id: locationId, district: trimmed })
    .select();

  // 23505 = unique_violation — район уже есть, ничего страшного, просто игнорируем.
  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
  syncIfEnabled();
}

export async function setLocationDistricts(locationId, districts) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error: delError } = await supabase
    .from('location_districts')
    .delete()
    .eq('location_id', locationId);

  if (delError) throw new Error(delError.message);

  const unique = [...new Set((districts || []).map((d) => (d || '').trim()).filter(Boolean))];
  if (unique.length === 0) {
    syncIfEnabled();
    return;
  }

  const rows = unique.map((district) => ({ location_id: locationId, district }));

  const { error: insError } = await supabase.from('location_districts').insert(rows);

  if (insError) throw new Error(insError.message);
  syncIfEnabled();
}

/** Rename a district: update location_districts and cascade to all properties. */
export async function updateDistrictName(locationId, oldName, newName) {
  const trimmed = (newName || '').trim();
  if (!trimmed || trimmed === oldName) return;

  const current = await getLocationDistricts(locationId);
  const updated = current.map((d) => (d === oldName ? trimmed : d));
  await setLocationDistricts(locationId, updated);
  await updatePropertiesDistrictForLocation(locationId, oldName, trimmed);
}

/** Remove a district: delete from location_districts and clear district in all affected properties. */
export async function removeDistrict(locationId, districtName) {
  const current = await getLocationDistricts(locationId);
  const updated = current.filter((d) => d !== districtName);
  await setLocationDistricts(locationId, updated);
  await updatePropertiesDistrictForLocation(locationId, districtName, null);
}

function formatLocation(loc) {
  return [loc.country, loc.region, loc.city].filter(Boolean).join(' / ');
}

function mapLocation(row) {
  return {
    id: row.id,
    country: row.country || '',
    region: row.region || '',
    city: row.city || '',
    displayName: formatLocation(row),
  };
}

export async function getLocationsForAgent(userId, companyId) {
  const { data, error } = await supabase
    .from('agent_location_access')
    .select('locations(*)')
    .eq('user_id', userId)
    .eq('company_id', companyId);
  if (error) return [];
  return (data || []).map(r => r.locations).filter(Boolean).map(mapLocation);
}

/** Returns all locations belonging to the company owner (admin's locations for the company). */
export async function getCompanyLocations(companyId) {
  const { data: company, error: compErr } = await supabase
    .from('companies')
    .select('owner_id')
    .eq('id', companyId)
    .single();
  if (compErr || !company) return [];

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('user_id', company.owner_id)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map(mapLocation);
}
