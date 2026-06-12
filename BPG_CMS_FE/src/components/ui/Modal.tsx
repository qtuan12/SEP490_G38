import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  maxWidth?: string; // For backwards compatibility
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  width = 'md',
  maxWidth 
}) => {
  if (!isOpen) return null;

  const widthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    full: 'sm:max-w-full sm:m-4',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Modal panel */}
        <div 
          className={`relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full ${widthClasses[width]}`}
          style={maxWidth ? { maxWidth } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="bg-white px-4 py-4 sm:px-6 border-b border-gray-200 flex justify-between items-center">
              {typeof title === 'string' ? (
                <h3 className="text-lg font-semibold leading-6 text-gray-900" id="modal-title">
                  {title}
                </h3>
              ) : (
                title
              )}
              <button
                type="button"
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={onClose}
              >
                <span className="sr-only">Đóng</span>
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Body */}
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-gray-200">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
