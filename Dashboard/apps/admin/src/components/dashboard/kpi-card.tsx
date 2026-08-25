import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number; // percentage change
  icon?: LucideIcon;
  /** Show as urgent (e.g., low stock) */
  urgent?: boolean;
}

export function KPICard({ title, value, change, icon: Icon, urgent }: KPICardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        urgent && 'border-red-200 bg-red-50/30'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 text-2xl font-semibold text-surface-900 tabular-nums">{value}</p>
          {change !== undefined && (
            <div className="mt-1.5 flex items-center gap-1">
              {change > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : change < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : (
                <Minus className="h-3 w-3 text-surface-400" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  change > 0 && 'text-green-600',
                  change < 0 && 'text-red-600',
                  change === 0 && 'text-surface-500'
                )}
              >
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}%
              </span>
              <span className="text-xs text-surface-400">vs yesterday</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
              urgent ? 'bg-red-100 text-red-600' : 'bg-surface-100 text-surface-500'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
