import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddingClass = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }[padding];

  return (
    <div className={cn('bg-white rounded-lg border border-surface-200', paddingClass, className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, icon: Icon, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-surface-400" />}
        <div>
          <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-surface-500">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
