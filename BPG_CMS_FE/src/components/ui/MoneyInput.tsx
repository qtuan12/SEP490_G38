import React, { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../../utils/formatNumber';

export interface MoneyInputProps {
  /** Giá trị số thô dạng chuỗi (dấu chấm thập phân) — parseFloat được ngay, vd "10003000", "1000.5". */
  value: string;
  /** Trả về giá trị thô mới (luôn dấu chấm thập phân) mỗi khi người dùng gõ. */
  onChange: (raw: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

/**
 * Ô nhập tiền: hiển thị định dạng vi-VN ngay khi gõ (hàng nghìn cách bằng ".", thập phân bằng
 * ",") nhưng luôn báo lên component cha giá trị số thô dấu chấm thập phân — không phá logic
 * tính toán hiện có (parseFloat, buildItems, tổng tiền...) vốn đang đọc trực tiếp state chuỗi.
 *
 * Dùng type="text" thay vì "number": input number của trình duyệt không chấp nhận dấu chấm/
 * phẩy làm ký tự hiển thị, nên không thể vừa gõ số vừa thấy phân cách hàng nghìn.
 */
export const MoneyInput: React.FC<MoneyInputProps> = ({ value, onChange, className = '', ...rest }) => {
  const [display, setDisplay] = useState(() => formatNumber(value, 3));
  const focused = useRef(false);

  // Đồng bộ lại khi cha đổi value từ bên ngoài (đổi dòng, đổi đơn vị, reset form...).
  // Không đè trong lúc người dùng đang gõ dở — gõ xong dấu phẩy mà chưa nhập số thập phân
  // thì formatNumber sẽ cắt mất dấu phẩy đó nếu đồng bộ lại ngay.
  useEffect(() => {
    if (!focused.current) setDisplay(formatNumber(value, 3));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^\d,]/g, '');
    const firstComma = cleaned.indexOf(',');
    // Chỉ giữ dấu phẩy đầu tiên làm dấu thập phân, bỏ các dấu phẩy gõ thừa sau đó.
    const normalized = firstComma === -1
      ? cleaned
      : cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '');

    const [intPartRaw, decPart] = normalized.split(',');
    const intPart = intPartRaw || '';
    const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    setDisplay(decPart !== undefined ? `${groupedInt},${decPart}` : groupedInt);
    onChange(decPart !== undefined ? `${intPart}.${decPart}` : intPart);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setDisplay(formatNumber(value, 3)); }}
      onChange={handleChange}
      // Base khớp với component Input dùng chung, để thay thế Input type="number" không
      // đổi giao diện ở những trang đang dùng Tailwind (vd trang tạo đơn hàng).
      className={`block w-full rounded-md shadow-sm sm:text-sm transition-colors border border-gray-300
        px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${className}`}
      {...rest}
    />
  );
};
