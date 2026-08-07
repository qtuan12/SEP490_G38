import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

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
    <div className="flex w-full items-center justify-center py-6" style={{ minHeight }}>
      <LoadingSpinner size="md" label={message} />
    </div>
  );

  if (isTable) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center" style={{ minHeight }}>
          {content}
        </td>
      </tr>
    );
  }
  return content;
};

