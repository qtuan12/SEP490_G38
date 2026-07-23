import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

export interface DateInputProps {
  value: string; // ISO yyyy-mm-dd hoặc ''
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  title?: string;
  className?: string;
}

// Trình duyệt hiển thị <input type="date"> theo locale hệ điều hành (có thể ra mm/dd/yyyy),
// nên ta tự vẽ phần text hiển thị theo đúng dd/mm/yyyy, còn input gốc chỉ dùng để mở lịch chọn ngày.
const toDisplay = (iso: string) => {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, min, max, title, className = '' }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    el?.showPicker?.();
  };

  return (
    <div className={`relative ${className}`} onClick={openPicker}>
      <div className="flex items-center justify-between gap-1.5 h-full px-2.5 py-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--bg-main))] cursor-pointer">
        <span className={`text-sm truncate ${value ? 'text-[hsl(var(--text-primary))]' : 'text-[hsl(var(--text-muted))]'}`}>
          {value ? toDisplay(value) : 'dd/mm/yyyy'}
        </span>
        <Calendar size={14} className="text-[hsl(var(--text-muted))] shrink-0" />
      </div>
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        title={title}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};
