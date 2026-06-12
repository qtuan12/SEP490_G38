import React, { type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`block w-full rounded-md shadow-sm sm:text-sm transition-colors px-3 py-2
          ${error 
            ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
          disabled:bg-gray-50 disabled:text-gray-500
          ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
