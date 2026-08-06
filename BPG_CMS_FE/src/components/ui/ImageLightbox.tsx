import React, { useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface ImageLightboxProps {
  /** Danh sách ảnh của cùng một nhóm — cho phép lật qua lại mà không cần đóng mở lại. */
  images: string[];
  /** Chỉ số ảnh đang xem. null = đóng. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  /** Nhãn hiển thị ở góc trên, ví dụ "Ảnh hóa đơn". */
  label?: string;
}

/**
 * Xem ảnh phóng to ngay tại chỗ thay vì mở tab mới.
 *
 * Nằm trên cả Modal (z-index 1000) vì thường được mở từ bên trong một modal chi tiết.
 * Đóng bằng phím Esc, nút X, hoặc bấm ra nền; lật ảnh bằng phím mũi tên.
 */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images, index, onClose, onIndexChange, label,
}) => {
  const isOpen = index !== null && index >= 0 && index < images.length;

  const goPrev = useCallback(() => {
    if (index === null) return;
    onIndexChange((index - 1 + images.length) % images.length);
  }, [index, images.length, onIndexChange]);

  const goNext = useCallback(() => {
    if (index === null) return;
    onIndexChange((index + 1) % images.length);
  }, [index, images.length, onIndexChange]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, goPrev, goNext]);

  if (!isOpen) return null;

  const currentUrl = images[index!];
  const hasMany = images.length > 1;

  const navButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'hsl(0 0% 100% / 0.9)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'hsl(224 71% 4%)',
    boxShadow: '0 2px 8px hsl(224 71% 4% / 0.3)',
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'hsl(224 71% 4% / 0.85)',
        padding: '48px 16px',
      }}
    >
      {/* Thanh trên: nhãn + số thứ tự + mở ảnh gốc + đóng */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', color: '#fff', fontSize: '0.9rem',
        }}
      >
        <span>
          {label}{hasMany ? ` ${index! + 1}/${images.length}` : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Mở ảnh gốc ở tab mới"
            style={{ color: '#fff', display: 'flex', alignItems: 'center', padding: '6px' }}
          >
            <ExternalLink size={18} />
          </a>
          <button
            type="button"
            onClick={onClose}
            title="Đóng (Esc)"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#fff', display: 'flex', alignItems: 'center', padding: '6px',
            }}
          >
            <X size={22} />
          </button>
        </span>
      </div>

      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex' }}
      >
        <img
          src={currentUrl}
          alt={label ?? 'Ảnh'}
          style={{
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 96px)',
            objectFit: 'contain',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: '#fff',
          }}
        />

        {hasMany && (
          <>
            <button type="button" onClick={goPrev} title="Ảnh trước (←)" style={{ ...navButtonStyle, left: '-52px' }}>
              <ChevronLeft size={22} />
            </button>
            <button type="button" onClick={goNext} title="Ảnh sau (→)" style={{ ...navButtonStyle, right: '-52px' }}>
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
