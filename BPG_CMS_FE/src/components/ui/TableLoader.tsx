import React from 'react';
import { Loader2 } from 'lucide-react';

interface TableLoaderProps {
  colSpan?: number;
  message?: string;
  minHeight?: string;
  isTable?: boolean;
}

export const TableLoader: React.FC<TableLoaderProps> = ({
  colSpan = 1,
  message = 'Đang tải dữ liệu...',
  minHeight = '200px',
  isTable = true,
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3 text-[hsl(var(--text-muted))] py-6">
      <Loader2 size={28} className="animate-spin text-[hsl(var(--primary))]" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );

  if (isTable) {
    return (
      <tr>
        <td colSpan={colSpan} style={{ minHeight, textAlign: 'center' }}>
          {content}
        </td>
      </tr>
    );
  }
  return <div className="flex w-full items-center justify-center" style={{ minHeight }}>{content}</div>;
};
