import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
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

/** Загружает аватар пользователя в Supabase Storage и возвращает публичный URL */
export async function uploadAvatar(localUri) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const ext = localUri.split('.').pop()?.split('?')[0] || 'jpg';
  const fileName = `avatars/${session.user.id}/avatar_${Date.now()}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: 'base64',
  });

  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, decode(base64), { contentType, upsert: true });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/** Загружает логотип компании в Supabase Storage (PNG рекомендуется для прозрачности) */
export async function uploadCompanyLogo(localUri) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const ext = localUri.split('.').pop()?.split('?')[0] || 'png';
  const fileName = `avatars/${session.user.id}/company_logo_${Date.now()}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: 'base64',
  });

  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, decode(base64), { contentType, upsert: true });

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

// TD-064: оригинал + миниатюра 150px одной операцией. Возвращает { url, thumbUrl }.
export async function uploadPhotoWithThumb(localUri) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const baseName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fullPath = `${baseName}.jpg`;
  const thumbPath = `${baseName}_thumb.jpg`;

  const fullBase64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, decode(fullBase64), { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw new Error(upErr.message);

  // Если миниатюра не залилась (упал интернет, ImageManipulator упал) — удаляем уже залитый оригинал, чтобы не оставлять мусор в Storage.
  try {
    const { uri: thumbLocal } = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 150 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    const thumbBase64 = await FileSystem.readAsStringAsync(thumbLocal, { encoding: 'base64' });
    const { error: thumbErr } = await supabase.storage
      .from(BUCKET)
      .upload(thumbPath, decode(thumbBase64), { contentType: 'image/jpeg', upsert: false });
    if (thumbErr) throw new Error(thumbErr.message);
  } catch (e) {
    try { await supabase.storage.from(BUCKET).remove([fullPath]); } catch {}
    throw e;
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
  const { data: pubThumb } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
  return { url: pub.publicUrl, thumbUrl: pubThumb.publicUrl };
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
