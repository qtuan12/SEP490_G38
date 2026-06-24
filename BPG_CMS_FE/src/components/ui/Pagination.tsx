import React from 'react';


export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, className }) => {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex justify-center mt-6 ${className || ''}`}>
      <div className="flex items-center gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] disabled:opacity-50 disabled:cursor-not-allowed border-none transition-colors cursor-pointer"
        >
          Trang trước
        </button>
        <div className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-[hsl(var(--border-light))] text-[hsl(var(--primary))] shadow-sm">
          Trang {currentPage} / {totalPages}
        </div>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--bg-main))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] disabled:opacity-50 disabled:cursor-not-allowed border-none transition-colors cursor-pointer"
        >
          Trang sau
        </button>
      </div>
    </div>
  );
};
