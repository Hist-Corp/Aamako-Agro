'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Optional element rendered inside the field (e.g. password show/hide toggle), vertically centered on the input itself. */
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, trailing, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-surface-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'h-9 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 placeholder:text-surface-400',
              trailing && 'pr-11',
              'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
              'disabled:opacity-50 disabled:bg-surface-50',
              error && 'border-red-300 focus:ring-red-500/40 focus:border-red-500',
              className
            )}
            {...props}
          />
          {trailing && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
              {trailing}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-surface-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
