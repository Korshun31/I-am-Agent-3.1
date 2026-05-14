// Одноразовый скрипт: для всех объектов в БД, у которых есть фотки, но нет миниатюр,
// генерирует миниатюры (150px ширина, JPEG 85%) и заливает их в тот же бакет
// `property-photos` с суффиксом `_thumb` в имени файла. Потом обновляет
// поле properties.photos_thumb массивом public URL миниатюр.
//
// Запуск: node scripts/backfill-property-thumbs.js
//
// Требует .env с SUPABASE_SERVICE_ROLE_KEY (service_role обходит RLS — нужен
// чтобы читать и писать любые объекты в Storage и БД).

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const SUPABASE_URL = 'https://doosuanuttihcyxtkarf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'property-photos';
const THUMB_WIDTH = 150;
const THUMB_QUALITY = 85;
const CONCURRENCY = 4; // не больше 4 фоток параллельно — иначе Storage rate-limit

if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === 'ВСТАВЬ_СЮДА_КЛЮЧ') {
  console.error('❌ Нет SUPABASE_SERVICE_ROLE_KEY в .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Извлекает storage-путь из public URL Supabase Storage.
// Пример: https://xxx.supabase.co/storage/v1/object/public/property-photos/abc/123.jpg
//   → "abc/123.jpg"
function urlToStoragePath(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length).split('?')[0];
}

function thumbPathFromOriginal(origPath) {
  const dot = origPath.lastIndexOf('.');
  if (dot < 0) return `${origPath}_thumb`;
  return `${origPath.slice(0, dot)}_thumb${origPath.slice(dot)}`;
}

async function downloadAsBuffer(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(`download ${storagePath}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function uploadBuffer(storagePath, buffer) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return pub.publicUrl;
}

async function thumbForOnePhoto(photoUrl) {
  const origPath = urlToStoragePath(photoUrl);
  if (!origPath) throw new Error(`не распарсил путь из ${photoUrl}`);
  const thumbPath = thumbPathFromOriginal(origPath);

  const buf = await downloadAsBuffer(origPath);
  const thumbBuf = await sharp(buf)
    .rotate() // учесть EXIF-ориентацию
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer();
  return uploadBuffer(thumbPath, thumbBuf);
}

async function processProperty(prop, idx, total) {
  const photos = Array.isArray(prop.photos) ? prop.photos : [];
  if (photos.length === 0) return { ok: true, skipped: true };

  const thumbUrls = [];
  for (const photoUrl of photos) {
    try {
      const thumbUrl = await thumbForOnePhoto(photoUrl);
      thumbUrls.push(thumbUrl);
    } catch (e) {
      console.warn(`  ⚠ [${prop.id}] фотка пропущена: ${e.message}`);
      thumbUrls.push(photoUrl); // fallback: оригинал, чтобы массив не сбился по индексам
    }
  }

  const { error } = await supabase
    .from('properties')
    .update({ photos_thumb: thumbUrls })
    .eq('id', prop.id);
  if (error) throw new Error(`update properties: ${error.message}`);

  console.log(`✅ [${idx + 1}/${total}] ${prop.code || prop.id} — ${thumbUrls.length} миниатюр`);
  return { ok: true, count: thumbUrls.length };
}

async function runWithConcurrency(items, worker, limit) {
  const results = [];
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const myIdx = cursor++;
      try {
        results[myIdx] = await worker(items[myIdx], myIdx, items.length);
      } catch (e) {
        results[myIdx] = { ok: false, error: e.message };
        console.error(`❌ [${myIdx + 1}/${items.length}] ${items[myIdx].code || items[myIdx].id}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, next));
  return results;
}

async function main() {
  const retryIds = (process.env.RETRY_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

  console.log(retryIds.length > 0
    ? `Точечный перепрогон ${retryIds.length} объектов...`
    : 'Ищу объекты без миниатюр...');

  let query = supabase
    .from('properties')
    .select('id, code, photos, photos_thumb')
    .not('photos', 'is', null);
  if (retryIds.length > 0) query = query.in('id', retryIds);

  const { data, error } = await query;
  if (error) throw error;

  const todo = retryIds.length > 0
    ? (data || []).filter((p) => Array.isArray(p.photos) && p.photos.length > 0)
    : (data || []).filter((p) => {
        const photos = Array.isArray(p.photos) ? p.photos : [];
        const thumbs = Array.isArray(p.photos_thumb) ? p.photos_thumb : [];
        return photos.length > 0 && thumbs.length === 0;
      });

  console.log(`Найдено: ${todo.length} объектов с фото без миниатюр.`);
  if (todo.length === 0) {
    console.log('Нечего делать. Выходим.');
    return;
  }

  const t0 = Date.now();
  const results = await runWithConcurrency(todo, processProperty, CONCURRENCY);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const ok = results.filter((r) => r?.ok).length;
  const fail = results.length - ok;
  const totalThumbs = results.reduce((sum, r) => sum + (r?.count || 0), 0);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Готово за ${elapsed}с. Объектов: ${ok} ✅ / ${fail} ❌. Миниатюр: ${totalThumbs}.`);
}

main().catch((e) => {
  console.error('Скрипт упал:', e);
  process.exit(1);
});
