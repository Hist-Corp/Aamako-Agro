'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Show a destructive action button in the footer */
  destructiveAction?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
  };
  /** Show a primary action button in the footer */
  primaryAction?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
  };
  /** Maximum width */
  maxWidth?: 'sm' | 'md' | 'lg';
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  destructiveAction,
  primaryAction,
  maxWidth = 'md',
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full mx-4 bg-white rounded-xl shadow-xl border border-surface-200 animate-slide-in-up',
          'max-h-[92vh] flex flex-col',
          maxWidthClass
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
          <div>
            <h2 id="dialog-title" className="text-lg font-semibold text-surface-900">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-surface-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 focus-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 overflow-y-auto min-h-0">{children}</div>

        {/* Footer */}
        {(destructiveAction || primaryAction) && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-200 rounded-b-xl bg-surface-50 flex-shrink-0">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {destructiveAction && (
              <Button
                variant="danger"
                onClick={destructiveAction.onClick}
                isLoading={destructiveAction.isLoading}
              >
                {destructiveAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                onClick={primaryAction.onClick}
                isLoading={primaryAction.isLoading}
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
