// TD-100 / TD-104: универсальное канvas-сжатие изображений на вебе.
// Используется в WebPropertyEditPanel (фото объектов) и WebContactEditPanel (аватары контактов).
// Включает revokeObjectURL для освобождения blob-памяти и onerror для битых файлов.
export async function resizeImageFile(file, maxSize = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);

    img.onload = () => {
      let { width, height } = img;
      if (width <= maxSize && height <= maxSize) {
        cleanup();
        resolve(file);
        return;
      }
      if (width > height) {
        height = Math.round(height * maxSize / width);
        width = maxSize;
      } else {
        width = Math.round(width * maxSize / height);
        height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        cleanup();
        if (!blob) {
          resolve(file);
          return;
        }
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };

    img.onerror = () => {
      cleanup();
      // Битый или нечитаемый файл — возвращаем оригинал, пусть Storage сам решит.
      resolve(file);
    };

    img.src = objectUrl;
  });
}
