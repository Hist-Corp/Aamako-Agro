import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)}>
      {Icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-surface-100 mb-4">
          <Icon className="h-6 w-6 text-surface-400" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
      <p className="mt-1 text-sm text-surface-500 max-w-sm">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
