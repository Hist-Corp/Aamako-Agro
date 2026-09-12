import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-surface-500">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-surface-300">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-surface-700 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-surface-700 font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-surface-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-surface-500">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto sm:flex-none">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
