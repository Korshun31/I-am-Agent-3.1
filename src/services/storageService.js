import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

const BUCKET = 'property-photos';

export async function uploadPhoto(localUri) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const ext = localUri.split('.').pop()?.split('?')[0] || 'jpg';
  const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: 'base64',
  });

  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, decode(base64), { contentType, upsert: false });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

export async function uploadPhotos(localUris, onProgress) {
  const urls = [];
  for (let i = 0; i < localUris.length; i++) {
    const url = await uploadPhoto(localUris[i]);
    urls.push(url);
    onProgress?.(i + 1, localUris.length);
  }
  return urls;
}

export function isLocalUri(uri) {
  return uri && (uri.startsWith('file://') || uri.startsWith('ph://') || uri.startsWith('content://'));
}

export function isStorageUrl(url) {
  return url && typeof url === 'string' && url.includes('/storage/') && url.includes(BUCKET);
}

export async function deletePhotoFromStorage(url) {
  if (!url || !isStorageUrl(url)) return;
  try {
    const prefix = `/${BUCKET}/`;
    const idx = url.indexOf(prefix);
    if (idx === -1) return;
    let path = url.slice(idx + prefix.length).split('?')[0];
    path = decodeURIComponent(path);
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {}
}
