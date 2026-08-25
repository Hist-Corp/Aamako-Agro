'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'status-badge--success',
  warning: 'status-badge--warning',
  danger: 'status-badge--danger',
  info: 'status-badge--info',
  neutral: 'status-badge--neutral',
};

export function Badge({ children, variant = 'neutral', dot = false, className }: BadgeProps) {
  return (
    <span className={cn('status-badge', variantClasses[variant], className)}>
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-green-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'danger' && 'bg-red-500',
            variant === 'info' && 'bg-blue-500',
            variant === 'neutral' && 'bg-surface-400'
          )}
        />
      )}
      {children}
    </span>
  );
}

/** Map common status strings to badge variants */
export function statusToBadgeVariant(
  status: string | undefined | null
): { variant: BadgeVariant; label: string } {
  if (!status) return { variant: 'neutral', label: 'Unknown' };
  const s = status.toLowerCase();
  if (['active', 'approved', 'delivered', 'passed', 'completed', 'paid', 'completed'].includes(s)) {
    return { variant: 'success', label: status.replace(/_/g, ' ') };
  }
  if (
    ['pending', 'processing', 'confirmed', 'initiated', 'in_progress', 'partially_refunded', 'quarantined'].includes(s)
  ) {
    return { variant: 'warning', label: status.replace(/_/g, ' ') };
  }
  if (
    ['cancelled', 'rejected', 'failed', 'refunded', 'expired', 'suspended', 'deactivated', 'archived'].includes(s)
  ) {
    return { variant: 'danger', label: status.replace(/_/g, ' ') };
  }
  if (['shipped', 'ready_to_ship', 'draft'].includes(s)) {
    return { variant: 'info', label: status.replace(/_/g, ' ') };
  }
  return { variant: 'neutral', label: status.replace(/_/g, ' ') };
}
