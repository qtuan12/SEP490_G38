import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-slide-up" onClick={(e) => e.stopPropagation()} style={maxWidth ? { maxWidth } : undefined}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button 
            onClick={onClose} 
            className="bg-transparent border-none text-[hsl(var(--text-secondary))] text-2xl cursor-pointer leading-none hover:text-[hsl(var(--text-primary))] transition-colors"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
