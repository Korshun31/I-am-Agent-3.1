import { supabase } from './supabase';

export async function getLocations() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('agent_id', session.user.id)
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
      agent_id: session.user.id,
      country: country || '',
      region: region || '',
      city: city || '',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapLocation(data);
}

export async function updateLocation(id, { country, region, city }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const updates = {};
  if (country !== undefined) updates.country = country;
  if (region !== undefined) updates.region = region;
  if (city !== undefined) updates.city = city;

  const { data, error } = await supabase
    .from('locations')
    .update(updates)
    .eq('id', id)
    .eq('agent_id', session.user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapLocation(data);
}

export async function deleteLocation(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id)
    .eq('agent_id', session.user.id);

  if (error) throw new Error(error.message);
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

export async function setLocationDistricts(locationId, districts) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error: delError } = await supabase
    .from('location_districts')
    .delete()
    .eq('location_id', locationId);

  if (delError) throw new Error(delError.message);

  const unique = [...new Set((districts || []).map((d) => (d || '').trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const rows = unique.map((district) => ({ location_id: locationId, district }));

  const { error: insError } = await supabase.from('location_districts').insert(rows);

  if (insError) throw new Error(insError.message);
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
