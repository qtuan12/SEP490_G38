import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, className }) => {
  return (
    <div className={`flex justify-center items-center mt-4 gap-4 ${className || ''}`} style={{ padding: '16px 0' }}>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        style={{
          color: currentPage === 1 ? 'hsl(var(--text-muted))' : 'hsl(var(--text-secondary))',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          background: 'none',
          border: 'none',
          fontWeight: 500,
          fontSize: '0.9rem'
        }}
      >
        Trang trước
      </button>

      <div style={{
        padding: '6px 16px',
        border: '1px solid hsl(var(--border))',
        borderRadius: '20px',
        fontWeight: 600,
        color: '#2563eb', // text-blue-600
        fontSize: '0.9rem',
        backgroundColor: 'white'
      }}>
        <span style={{ color: '#2563eb' }}>Trang {currentPage}</span> <span style={{ color: 'hsl(var(--text-secondary))' }}>/ {Math.max(1, totalPages)}</span>
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        style={{
          color: currentPage >= totalPages ? 'hsl(var(--text-muted))' : 'hsl(var(--text-secondary))',
          cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
          background: 'none',
          border: 'none',
          fontWeight: 500,
          fontSize: '0.9rem'
        }}
      >
        Trang sau
      </button>
    </div>
  );
};
