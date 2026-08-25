'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuditLogs } from '@/lib/api-hooks';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import type { AuditLog, AuditEntityType, AuditAction } from '@aamako/shared-types';
import { FileText, ChevronRight, ChevronDown } from 'lucide-react';

const ENTITY_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'ORDER', label: 'Orders' },
  { value: 'PRODUCT', label: 'Products' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'BATCH', label: 'Batches' },
  { value: 'BUSINESS', label: 'Businesses' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'REVIEW', label: 'Reviews' },
  { value: 'USER', label: 'Users' },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  STATUS_CHANGE: 'warning',
  APPROVE: 'success',
  REJECT: 'danger',
  RECALL: 'danger',
  ADJUST: 'warning',
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
};

/** Screen: Audit Log
 *  Can view: ADMIN (all), SUPER_ADMIN (all)
 *  Read-only screen — no actions possible here
 */
export default function AuditLogPage() {
  const [entityFilter, setEntityFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logsData, isLoading } = useAuditLogs({
    entityType: (entityFilter as AuditEntityType) || undefined,
  });
  const logs = logsData?.data ?? [];

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Time',
        cell: ({ row }) => (
          <div>
            <p className="text-sm tabular-nums">{formatDateTime(row.original.createdAt)}</p>
            <p className="text-2xs text-surface-400">{relativeTime(row.original.createdAt)}</p>
          </div>
        ),
        size: 180,
      },
      {
        accessorKey: 'actorName',
        header: 'Actor',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-surface-900">{row.original.actorName}</p>
            <p className="text-2xs text-surface-400">{row.original.actorEmail}</p>
          </div>
        ),
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => {
          const variant = (ACTION_COLORS[row.original.action] ?? 'neutral') as any;
          return (
            <Badge variant={variant}>
              {row.original.action.replace(/_/g, ' ')}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'entityType',
        header: 'Entity',
        cell: ({ row }) => (
          <span className="text-sm text-surface-600">{row.original.entityType}</span>
        ),
      },
      {
        accessorKey: 'entityLabel',
        header: 'Target',
        cell: ({ row }) => (
          <div>
            <p className="text-sm text-surface-700">{row.original.entityLabel}</p>
            <p className="text-2xs text-surface-400 font-mono">{row.original.entityId.slice(0, 8)}…</p>
          </div>
        ),
      },
      {
        id: 'expand',
        header: '',
        size: 40,
        cell: ({ row }) => {
          const hasChanges = row.original.before || row.original.after;
          if (!hasChanges) return null;
          return (
            <button
              className="p-1 rounded text-surface-400 hover:text-surface-600"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedRow(expandedRow === row.original.id ? null : row.original.id);
              }}
            >
              {expandedRow === row.original.id ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          );
        },
      },
    ],
    [expandedRow]
  );

  // Custom row renderer to support expandable detail
  const expandedColumns = useMemo(() => {
    if (!expandedRow) return columns;

    const log = logs.find((l) => l.id === expandedRow);
    if (!log) return columns;

    // We add an expanded detail row after the matching row
    return columns;
  }, [columns, expandedRow, logs]);

  const tabs = [
    { id: '', label: 'All' },
    { id: 'ORDER', label: 'Orders' },
    { id: 'INVENTORY', label: 'Inventory' },
    { id: 'BATCH', label: 'Batches' },
    { id: 'BUSINESS', label: 'Businesses' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Complete record of all actions across the platform"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Audit Log' }]}
      />

      <Tabs tabs={tabs} activeTab={entityFilter} onChange={setEntityFilter} />

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        searchPlaceholder="Search by actor, entity, action…"
        emptyState={
          <EmptyState
            icon={FileText}
            title="No audit entries yet"
            description="Audit log entries are created automatically whenever someone takes an action in the dashboard. This provides full accountability for every change."
          />
        }
      />

      {/* Expanded row detail */}
      {expandedRow && (() => {
        const log = logs.find((l) => l.id === expandedRow);
        if (!log || (!log.before && !log.after)) return null;

        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center" onClick={() => setExpandedRow(null)}>
            <div className="absolute inset-0 bg-black/20" />
            <div
              className="relative bg-white rounded-xl border border-surface-200 shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-surface-900 mb-1">Change Detail</h3>
              <p className="text-sm text-surface-500 mb-4">
                {log.action.replace(/_/g, ' ')} on {log.entityType}: {log.entityLabel}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {log.before && (
                  <div>
                    <p className="text-xs font-semibold text-surface-500 uppercase mb-2">Before</p>
                    <pre className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-surface-700 overflow-x-auto">
                      {JSON.stringify(log.before, null, 2)}
                    </pre>
                  </div>
                )}
                {log.after && (
                  <div>
                    <p className="text-xs font-semibold text-surface-500 uppercase mb-2">After</p>
                    <pre className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-surface-700 overflow-x-auto">
                      {JSON.stringify(log.after, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <button
                onClick={() => setExpandedRow(null)}
                className="mt-4 text-sm text-brand-600 hover:text-brand-800 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
