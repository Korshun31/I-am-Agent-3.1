import { supabase } from './supabase';

export async function getContacts(type) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('agent_id', session.user.id)
    .eq('type', type)
    .order('name', { ascending: true });

  if (error) {
    console.error('getContacts error:', error.message);
    return [];
  }

  return (data || []).map(mapContact);
}

export async function getContactById(id) {
  if (!id) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('agent_id', session.user.id)
    .single();

  if (error || !data) return null;
  return mapContact(data);
}

export async function createContact(contactData) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const row = {
    agent_id: session.user.id,
    type: contactData.type || 'clients',
    name: contactData.name || '',
    last_name: contactData.lastName || '',
    phone: contactData.phone || '',
    email: contactData.email || '',
    telegram: contactData.telegram || '',
    whatsapp: contactData.whatsapp || '',
    document_number: contactData.documentNumber || '',
    nationality: contactData.nationality || '',
    birthday: contactData.birthday || '',
    photo_url: contactData.photoUri || '',
    extra_phones: contactData.extraPhones || [],
    extra_emails: contactData.extraEmails || [],
  };

  const { data, error } = await supabase
    .from('contacts')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapContact(data);
}

export async function updateContact(id, contactData) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const updates = {};
  if (contactData.name !== undefined) updates.name = contactData.name;
  if (contactData.lastName !== undefined) updates.last_name = contactData.lastName;
  if (contactData.phone !== undefined) updates.phone = contactData.phone;
  if (contactData.email !== undefined) updates.email = contactData.email;
  if (contactData.telegram !== undefined) updates.telegram = contactData.telegram;
  if (contactData.whatsapp !== undefined) updates.whatsapp = contactData.whatsapp;
  if (contactData.documentNumber !== undefined) updates.document_number = contactData.documentNumber;
  if (contactData.nationality !== undefined) updates.nationality = contactData.nationality;
  if (contactData.birthday !== undefined) updates.birthday = contactData.birthday;
  if (contactData.photoUri !== undefined) updates.photo_url = contactData.photoUri;
  if (contactData.extraPhones !== undefined) updates.extra_phones = contactData.extraPhones;
  if (contactData.extraEmails !== undefined) updates.extra_emails = contactData.extraEmails;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .eq('agent_id', session.user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapContact(data);
}

export async function deleteContact(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('agent_id', session.user.id);

  if (error) throw new Error(error.message);
}

function mapContact(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name || '',
    lastName: row.last_name || '',
    phone: row.phone || '',
    email: row.email || '',
    telegram: row.telegram || '',
    whatsapp: row.whatsapp || '',
    documentNumber: row.document_number || '',
    nationality: row.nationality || '',
    birthday: row.birthday || '',
    photoUri: row.photo_url || '',
    extraPhones: Array.isArray(row.extra_phones) ? row.extra_phones : [],
    extraEmails: Array.isArray(row.extra_emails) ? row.extra_emails : [],
  };
}
