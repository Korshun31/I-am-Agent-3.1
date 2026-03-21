import { supabase } from './supabase';
import { syncIfEnabled } from './dataUploadService';

export async function getProperties() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('name', { ascending: true })
    .limit(10000);

  if (error) {
    console.error('getProperties error:', error.message);
    return [];
  }

  return data || [];
}

export async function createProperty({ name, code, type, location_id, owner_id }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('properties')
    .insert({
      agent_id: session.user.id,
      name: name || '',
      code: code || '',
      type: type || 'house',
      location_id: location_id || null,
      owner_id: owner_id || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return data;
}

/** Create a full property (e.g. house in resort) with all fields. */
export async function createPropertyFull(updates) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const row = {
    agent_id: session.user.id,
    ...updates,
  };

  const { data, error } = await supabase
    .from('properties')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return data;
}

export async function updateProperty(id, updates) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', id)
    .eq('agent_id', session.user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return data;
}

export async function deleteProperty(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', id)
    .eq('agent_id', session.user.id);

  if (error) throw new Error(error.message);
  syncIfEnabled();
}

/**
 * Update district for all properties in a location that had the old district.
 * Used when renaming or deleting a district in location_districts.
 * Cascades to resort/condo children.
 */
export async function updatePropertiesDistrictForLocation(locationId, oldDistrict, newDistrict) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: props, error: fetchErr } = await supabase
    .from('properties')
    .select('id, type, resort_id')
    .eq('agent_id', session.user.id)
    .eq('location_id', locationId)
    .eq('district', oldDistrict);

  if (fetchErr || !props?.length) {
    syncIfEnabled();
    return;
  }

  const ids = props.map((p) => p.id);
  await supabase
    .from('properties')
    .update({ district: newDistrict || null })
    .in('id', ids)
    .eq('agent_id', session.user.id);

  const resortIds = props.filter((p) => p.type === 'resort' || p.type === 'condo').map((p) => p.id);
  for (const rid of resortIds) {
    await updateResortChildrenDistrict(rid, newDistrict);
  }
  syncIfEnabled();
}

/** Update district for all houses in a resort (cascade when resort district changes). */
export async function updateResortChildrenDistrict(resortId, district) {
  if (!resortId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: children, error: fetchErr } = await supabase
    .from('properties')
    .select('id')
    .eq('resort_id', resortId)
    .eq('agent_id', session.user.id);

  if (fetchErr || !children?.length) return;
  const ids = children.map((c) => c.id);
  await supabase
    .from('properties')
    .update({ district: district || null })
    .in('id', ids)
    .eq('agent_id', session.user.id);
  syncIfEnabled();
}

export async function approveProperty(propertyId) {
  const { error } = await supabase
    .from('properties')
    .update({ property_status: 'approved' })
    .eq('id', propertyId);
  if (error) throw new Error(error.message);
}

export async function rejectProperty(propertyId, reason) {
  const { error } = await supabase
    .from('properties')
    .update({ property_status: 'rejected', rejection_reason: reason || '' })
    .eq('id', propertyId);
  if (error) throw new Error(error.message);
}
