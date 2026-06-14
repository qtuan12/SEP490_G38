import React, { type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: { label: string; value: string | number; disabled?: boolean }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', error, options, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`block w-full rounded-md shadow-sm sm:text-sm transition-colors pl-3 pr-10 py-2
          ${error 
            ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
          disabled:bg-gray-50 disabled:text-gray-500
          ${className}`}
        {...props}
      >
        {options.map((opt, i) => (
          <option key={i} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);
Select.displayName = 'Select';
