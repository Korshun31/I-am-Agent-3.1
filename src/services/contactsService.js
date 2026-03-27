import { supabase } from './supabase';
import { syncIfEnabled } from './dataUploadService';
import { broadcastChange } from './companyChannel';
import * as FileSystem from 'expo-file-system/legacy';

// Bucket name in Supabase Storage
const PHOTOS_BUCKET = 'contact-photos';

/**
 * Uploads a local photo URI to Supabase Storage.
 * Returns the public https:// URL, or the original URI on failure.
 */
export async function uploadContactPhoto(localUri) {
  if (!localUri || localUri.startsWith('http')) return localUri;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Не авторизован');

    const ext = (localUri.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `${session.user.id}/${Date.now()}.${ext}`;

    // Use FormData — the standard React Native way to upload any file URI
    const formData = new FormData();
    formData.append('file', { uri: localUri, name: fileName, type: mimeType });

    const uploadUrl = `https://doosuanuttihcyxtkarf.supabase.co/storage/v1/object/${PHOTOS_BUCKET}/${fileName}`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Storage error: ${errText}`);
    }

    const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(fileName);
    console.log('[uploadContactPhoto] Success:', data.publicUrl);
    return data.publicUrl;
  } catch (e) {
    console.error('[uploadContactPhoto] Exception:', e.message);
    throw e;
  }
}

/**
 * Migration: uploads all local contact photos to Supabase Storage.
 * Safe to run multiple times — skips contacts that already have https:// URLs.
 * After all photos are migrated it finds 0 local files and finishes instantly.
 */
export async function migrateContactPhotos() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: rows, error } = await supabase
      .from('contacts')
      .select('id, photo_url')
      .eq('user_id', session.user.id)
      .not('photo_url', 'is', null)
      .neq('photo_url', '');

    if (error || !rows?.length) return;

    const local = rows.filter(r => r.photo_url && !r.photo_url.startsWith('http'));
    if (!local.length) return;

    console.log(`[PhotoMigration] Found ${local.length} contacts with local photos`);

    let migrated = 0;
    for (const row of local) {
      try {
        const info = await FileSystem.getInfoAsync(row.photo_url);
        if (!info.exists) continue;

        const publicUrl = await uploadContactPhoto(row.photo_url);
        if (publicUrl.startsWith('http')) {
          await supabase
            .from('contacts')
            .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
            .eq('id', row.id);
          migrated++;
          console.log(`[PhotoMigration] ✓ Migrated contact ${row.id}`);
        }
      } catch (e) {
        console.warn(`[PhotoMigration] Failed for contact ${row.id}:`, e.message);
      }
    }

    console.log(`[PhotoMigration] Done. Migrated ${migrated}/${local.length}`);
  } catch (e) {
    console.warn('[PhotoMigration] Error:', e.message);
  }
}

export async function getContacts(type) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  let q = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', session.user.id)
    .order('name', { ascending: true })
    .limit(10000);
  if (type) q = q.eq('type', type);
  const { data, error } = await q;

  if (error) {
    console.error('getContacts error:', error.message);
    return [];
  }

  return (data || []).map(mapContact);
}

export async function getContactsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .in('id', ids)
    .order('name', { ascending: true });
  if (error) return [];
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
    .eq('user_id', session.user.id)
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
    user_id: session.user.id,
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
    documents: contactData.documents || [],
  };

  const { data, error } = await supabase
    .from('contacts')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  broadcastChange('contacts');
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
  if (contactData.documents !== undefined) updates.documents = contactData.documents;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  broadcastChange('contacts');
  return mapContact(data);
}

export async function deleteContact(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) throw new Error(error.message);
  syncIfEnabled();
  broadcastChange('contacts');
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
    documents: Array.isArray(row.documents) ? row.documents : [],
  };
}
