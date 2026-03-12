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

  const extraTg = Array.isArray(contactData.extraTelegrams) ? contactData.extraTelegrams : [];
  const extraWa = Array.isArray(contactData.extraWhatsapps) ? contactData.extraWhatsapps : [];
  const row = {
    agent_id: session.user.id,
    type: contactData.type || 'clients',
    name: contactData.name || '',
    last_name: contactData.lastName || '',
    phone: contactData.phone || '',
    email: contactData.email || '',
    telegram: extraTg[0] || '',
    whatsapp: extraWa[0] || '',
    document_number: contactData.documentNumber || '',
    nationality: contactData.nationality || '',
    birthday: contactData.birthday || '',
    photo_url: contactData.photoUri || '',
    extra_phones: contactData.extraPhones || [],
    extra_emails: contactData.extraEmails || [],
    extra_telegrams: extraTg,
    extra_whatsapps: extraWa,
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
  if (contactData.extraTelegrams !== undefined) {
    const extraTg = Array.isArray(contactData.extraTelegrams) ? contactData.extraTelegrams : [];
    updates.extra_telegrams = extraTg;
    updates.telegram = extraTg[0] || '';
  }
  if (contactData.extraWhatsapps !== undefined) {
    const extraWa = Array.isArray(contactData.extraWhatsapps) ? contactData.extraWhatsapps : [];
    updates.extra_whatsapps = extraWa;
    updates.whatsapp = extraWa[0] || '';
  }
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
  const extraTelegrams = Array.isArray(row.extra_telegrams) ? row.extra_telegrams : (row.telegram ? [row.telegram] : []);
  const extraWhatsapps = Array.isArray(row.extra_whatsapps) ? row.extra_whatsapps : (row.whatsapp ? [row.whatsapp] : []);
  return {
    id: row.id,
    type: row.type,
    name: row.name || '',
    lastName: row.last_name || '',
    phone: row.phone || '',
    email: row.email || '',
    telegram: extraTelegrams[0] || row.telegram || '',
    whatsapp: extraWhatsapps[0] || row.whatsapp || '',
    documentNumber: row.document_number || '',
    nationality: row.nationality || '',
    birthday: row.birthday || '',
    photoUri: row.photo_url || '',
    extraPhones: Array.isArray(row.extra_phones) ? row.extra_phones : [],
    extraEmails: Array.isArray(row.extra_emails) ? row.extra_emails : [],
    extraTelegrams,
    extraWhatsapps,
  };
}
