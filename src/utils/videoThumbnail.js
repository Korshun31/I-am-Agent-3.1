export function getVideoThumbnailUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  let id = null;
  const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) id = { type: 'youtube', id: ytMatch[1] };
  const vimeoMatch = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) id = { type: 'vimeo', id: vimeoMatch[1] };
  if (!id) return null;
  if (id.type === 'youtube') return `https://img.youtube.com/vi/${id.id}/hqdefault.jpg`;
  if (id.type === 'vimeo') return `https://vumbnail.com/${id.id}.jpg`;
  return null;
}
