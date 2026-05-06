// TD-065 / TD-066: полноэкранная галерея фото объекта на вебе.
// Образец — мобильная PhotoGalleryModal в PropertyDetailScreen.js.
// Свайп ← →, Escape закрывает, ↓ скачивает, корзина удаляет с confirm.
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function WebPhotoGalleryModal({
  visible,
  photos = [],
  initialIndex = 0,
  canDelete = false,
  onClose,
  onDelete,
}) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(initialIndex);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);

  useEffect(() => { setIndex(initialIndex); setSaveMenuOpen(false); }, [initialIndex, visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, photos.length, onClose]);

  if (!visible || photos.length === 0) return null;

  const current = photos[index];

  const downloadOne = async (url) => {
    const fileName = url.split('/').pop()?.split('?')[0] || 'photo.jpg';
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };

  const handleDownloadCurrent = async () => {
    setSaveMenuOpen(false);
    await downloadOne(current);
  };

  const handleDownloadAll = async () => {
    setSaveMenuOpen(false);
    for (const url of photos) {
      await downloadOne(url);
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (!window.confirm(t('pdDeletePhoto') || 'Delete photo?')) return;
    const next = photos.filter((_, i) => i !== index);
    onDelete?.(next, current, index);
    if (next.length === 0) onClose?.();
    else setIndex(i => Math.min(i, next.length - 1));
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <button type="button" style={{ ...styles.btn, ...styles.closeBtn }} onClick={(e) => { e.stopPropagation(); onClose?.(); }}>✕</button>
      <button type="button" style={{ ...styles.btn, ...styles.downloadBtn }} onClick={(e) => { e.stopPropagation(); setSaveMenuOpen(o => !o); }} title="Download">↓</button>
      {canDelete && (
        <button type="button" style={{ ...styles.btn, ...styles.deleteBtn }} onClick={(e) => { e.stopPropagation(); handleDelete(); }} title={t('delete') || 'Delete'}>🗑</button>
      )}

      {saveMenuOpen && (
        <div style={styles.saveMenu} onClick={(e) => e.stopPropagation()}>
          <button type="button" style={styles.saveMenuItem} onClick={handleDownloadCurrent}>
            <span style={styles.saveMenuIcon}>📷</span>
            <span style={styles.saveMenuText}>Save this photo</span>
          </button>
          {photos.length > 1 && (
            <button type="button" style={{ ...styles.saveMenuItem, borderBottom: 'none' }} onClick={handleDownloadAll}>
              <span style={styles.saveMenuIcon}>📦</span>
              <span style={styles.saveMenuText}>Save all ({photos.length})</span>
            </button>
          )}
        </div>
      )}

      {photos.length > 1 && index > 0 && (
        <button type="button" style={{ ...styles.arrow, ...styles.arrowLeft }} onClick={(e) => { e.stopPropagation(); setIndex(i => i - 1); }}>‹</button>
      )}
      {photos.length > 1 && index < photos.length - 1 && (
        <button type="button" style={{ ...styles.arrow, ...styles.arrowRight }} onClick={(e) => { e.stopPropagation(); setIndex(i => i + 1); }}>›</button>
      )}

      <img
        src={current}
        alt=""
        style={styles.image}
        onClick={(e) => e.stopPropagation()}
      />

      <div style={styles.counter}>{index + 1} / {photos.length}</div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.92)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  image: {
    maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', userSelect: 'none',
  },
  btn: {
    position: 'absolute', top: 16,
    width: 44, height: 44, borderRadius: 22,
    background: 'rgba(255,255,255,0.12)', color: '#FFF',
    border: 'none', cursor: 'pointer',
    fontSize: 20, lineHeight: '44px', textAlign: 'center', padding: 0,
    fontWeight: 300,
  },
  closeBtn:    { right: 16 },
  downloadBtn: { right: 72 },
  deleteBtn:   { left: 16, color: '#FF6B6B' },
  arrow: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 56, height: 56, borderRadius: 28,
    background: 'rgba(255,255,255,0.12)', color: '#FFF',
    border: 'none', cursor: 'pointer',
    fontSize: 40, lineHeight: '56px', textAlign: 'center', padding: 0,
    fontWeight: 300,
  },
  arrowLeft:  { left: 24 },
  arrowRight: { right: 24 },
  counter: {
    position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.5)', color: '#FFF',
    padding: '6px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600,
  },
  saveMenu: {
    position: 'absolute', top: 70, right: 16,
    background: '#1F2937', borderRadius: 10, overflow: 'hidden',
    boxShadow: '0 6px 20px rgba(0,0,0,0.4)', minWidth: 200,
  },
  saveMenuItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '12px 16px',
    background: 'transparent', color: '#FFF',
    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer', textAlign: 'left',
  },
  saveMenuIcon: { fontSize: 18 },
  saveMenuText: { fontSize: 14, fontWeight: 500 },
};
