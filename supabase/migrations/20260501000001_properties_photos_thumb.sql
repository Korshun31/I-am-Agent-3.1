-- TD-064: миниатюры фотографий объектов (150px).
-- Параллельный массив URL миниатюр той же длины и порядка, что и photos.
-- Пустой массив — миниатюр ещё нет, код показывает оригинал из photos.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS photos_thumb text[] DEFAULT '{}' NOT NULL;

COMMENT ON COLUMN properties.photos_thumb IS
  'TD-064: миниатюры 150px. Параллельный массив той же длины/порядка, что photos. Пустой = миниатюр нет, fallback на оригинал.';
