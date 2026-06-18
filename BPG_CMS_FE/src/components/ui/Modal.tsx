import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  maxWidth?: string;
}

const WIDTH_MAP: Record<string, string> = {
  sm:   '420px',
  md:   '560px',
  lg:   '720px',
  xl:   '900px',
  full: '95vw',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen, onClose, title, children, footer, width = 'md', maxWidth,
}) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxW = maxWidth ?? WIDTH_MAP[width] ?? WIDTH_MAP.md;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'hsl(224 71% 4% / 0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        className="animate-slide-up"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: maxW,
          backgroundColor: 'hsl(var(--bg-card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 24px 48px hsl(224 71% 4% / 0.4), 0 0 0 1px hsl(var(--border))',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid hsl(var(--border))',
            flexShrink: 0,
          }}>
            {typeof title === 'string'
              ? <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{title}</h3>
              : title}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: 'hsl(var(--text-muted))', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid hsl(var(--border))',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
