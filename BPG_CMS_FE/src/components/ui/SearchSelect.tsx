import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tìm option hiện tại tương ứng với value
  const selectedOption = options.find(opt => opt.value === value);

  // Đồng bộ searchQuery khi value thay đổi từ ngoài hoặc khi component mount
  useEffect(() => {
    if (selectedOption) {
      setSearchQuery(selectedOption.label);
    } else {
      setSearchQuery('');
    }
  }, [value, selectedOption]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Tránh đóng dropdown khi click vào chính container (input/chevron) HOẶC click vào chính dropdown Portal
      if (
        (containerRef.current && containerRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        return;
      }
      
      setIsOpen(false);
      // Khôi phục lại searchQuery theo option đang chọn thực tế
      if (selectedOption) {
        setSearchQuery(selectedOption.label);
      } else {
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  // Lấy và cập nhật tọa độ của input để đặt vị trí cho Portal dropdown
  const updateCoords = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
        bottom: rect.top
      });
    }
  };

  // Theo dõi sự kiện scroll/resize để đóng hoặc cập nhật vị trí dropdown
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      
      const handleScrollOrResize = (event: Event) => {
        // Nếu sự kiện scroll xảy ra bên trong chính dropdown Portal, thì bỏ qua không đóng
        if (
          event.type === 'scroll' &&
          dropdownRef.current &&
          (dropdownRef.current === event.target || dropdownRef.current.contains(event.target as Node))
        ) {
          return;
        }
        // Đóng dropdown khi scroll/resize ở ngoài để tránh lệch layout
        setIsOpen(false);
      };

      // Đăng ký sự kiện scroll ở dạng capture để bắt được sự kiện scroll từ Modal body
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
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Nếu khoảng trống phía dưới ít hơn 220px và khoảng trống phía trên đủ rộng, thì mở lên trên
      if (spaceBelow < 220 && rect.top > 220) {
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
    left: `${coords.left}px`,
    width: `${coords.width}px`,
    zIndex: 9999,
    backgroundColor: 'white',
    border: '1px solid #cbd5e1', // border-slate-300
    borderRadius: '0.375rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    maxHeight: '240px',
    overflowY: 'auto',
    ...(placement === 'top' 
      ? { bottom: `${window.innerHeight - coords.bottom + 4}px` } 
      : { top: `${coords.top + 4}px` }
    )
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            // Nếu người dùng xóa sạch input, ta kích hoạt onChange rỗng để component cha nhận biết
            if (e.target.value === '') {
              onChange('');
            }
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          className={`block w-full rounded-md shadow-sm sm:text-sm pl-3 pr-12 py-2 border bg-white focus:outline-none transition-colors
            ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}
            ${error 
              ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()} // Ngăn sự kiện blur của input làm đóng dropdown trước khi click kịp ghi nhận
          onClick={() => {
            if (!disabled) {
              setIsOpen(prev => !prev);
              updateCoords();
            }
          }}
          disabled={disabled}
          className="absolute right-0 top-0 bottom-0 px-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'transform rotate-180 text-blue-500' : ''}`} />
        </button>
      </div>

      {isOpen && !disabled && createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className="search-select-dropdown">
          {/* Tùy chỉnh scrollbar cho dropdown */}
          <style>{`
            .search-select-dropdown::-webkit-scrollbar {
              width: 6px;
            }
            .search-select-dropdown::-webkit-scrollbar-track {
              background: #f1f5f9;
              border-radius: 4px;
            }
            .search-select-dropdown::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 4px;
            }
            .search-select-dropdown::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}</style>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault(); // Ngăn sự kiện blur của input làm đóng dropdown trước khi click kịp ghi nhận
                  onChange(opt.value);
                  setSearchQuery(opt.label);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 text-left
                  ${value === opt.value ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-800'}`}
              >
                <div className="text-xs">{opt.label}</div>
                {opt.sublabel && (
                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.sublabel}</div>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-2.5 text-xs text-slate-400 italic text-center">
              Không tìm thấy kết quả
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
