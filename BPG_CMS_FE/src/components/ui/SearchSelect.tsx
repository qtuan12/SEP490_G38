import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

export interface SearchSelectOption {
  label: string;
  value: string;
  sublabel?: string;
}

export interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
}

export const SearchSelect: React.FC<SearchSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  error,
  disabled,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, bottom: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tìm option hiện tại tương ứng với value
  const selectedOption = options.find(opt => opt.value === value);

  // Focus ô tìm kiếm khi vừa mở dropdown
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (containerRef.current && containerRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lấy và cập nhật tọa độ của trigger button để đặt vị trí cho Portal dropdown
  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: Math.max(rect.width, 240), // Đảm bảo độ rộng tối thiểu 240px cho ô search
        bottom: rect.top
      });
    }
  };

  // Theo dõi sự kiện scroll/resize để cập nhật hoặc đóng dropdown
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      
      const handleScrollOrResize = (event: Event) => {
        if (
          event.type === 'scroll' &&
          dropdownRef.current &&
          (dropdownRef.current === event.target || dropdownRef.current.contains(event.target as Node))
        ) {
          return;
        }
        setIsOpen(false);
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Tính toán hướng hiển thị khi mở dropdown
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 260 && rect.top > 260) {
        setPlacement('top');
      } else {
        setPlacement('bottom');
      }
    }
  }, [isOpen]);

  // Lọc các option dựa trên searchQuery
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Style cho Portal dropdown
  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    backgroundColor: 'hsl(var(--bg-card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.375rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
    ...(placement === 'top' 
      ? { bottom: `${window.innerHeight - coords.bottom + 4}px` } 
      : { top: `${coords.top + 4}px` }
    )
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button: Hiển thị giá trị đã chọn cố định, rất sạch sẽ */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(prev => !prev);
            updateCoords();
          }
        }}
        disabled={disabled}
        className={`flex items-center justify-between w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))] text-left focus:outline-none transition-colors cursor-pointer
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-[hsl(var(--border-light))]'}
          ${error 
            ? 'border-red-500 text-red-500 focus:ring-red-500' 
            : 'border-[hsl(var(--border))] focus:ring-blue-500'}`}
      >
        <span className={`block truncate ${selectedOption ? 'text-[hsl(var(--text-primary))] font-medium' : 'text-[hsl(var(--text-muted))]'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`ml-2 shrink-0 text-[hsl(var(--text-muted))] transition-transform duration-200 ${isOpen ? 'transform rotate-180 text-blue-500' : ''}`} />
      </button>

      {/* Popover Dropdown với Ô Tìm kiếm riêng ở trên cùng */}
      {isOpen && !disabled && createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className="search-select-dropdown overflow-hidden flex flex-col">
          <style>{`
            .search-select-dropdown-list::-webkit-scrollbar {
              width: 6px;
            }
            .search-select-dropdown-list::-webkit-scrollbar-track {
              background: hsl(var(--bg-main));
              border-radius: 4px;
            }
            .search-select-dropdown-list::-webkit-scrollbar-thumb {
              background: hsl(var(--border));
              border-radius: 4px;
            }
            .search-select-dropdown-list::-webkit-scrollbar-thumb:hover {
              background: hsl(var(--border-light));
            }
          `}</style>

          {/* Search Header: Ô tìm kiếm đính kèm biểu tượng 🔍 */}
          <div className="p-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg-main))] sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-[hsl(var(--text-muted))] pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên vật tư..."
                className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-[hsl(var(--border))] rounded bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))] focus:outline-none focus:border-blue-500 shadow-inner"
              />
            </div>
          </div>

          {/* Scrollable Items List */}
          <div className="search-select-dropdown-list max-h-[200px] overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-2 hover:bg-blue-500/10 cursor-pointer transition-colors border-b border-[hsl(var(--border))] last:border-0 text-left
                    ${value === opt.value ? 'bg-blue-500/15 text-blue-500 font-semibold' : 'text-[hsl(var(--text-primary))]'}`}
                >
                  <div className="text-xs">{opt.label}</div>
                  {opt.sublabel && (
                    <div className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">{opt.sublabel}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-slate-400 italic text-center">
                Không tìm thấy vật tư phù hợp
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
