import { supabase } from './supabase';

export async function getProperties() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('agent_id', session.user.id)
    .order('name', { ascending: true });

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
}
