'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/config/auth-context';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Headphones, MessageSquare, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface SupportTicket {
  id: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

const MOCK_TICKETS: SupportTicket[] = [
  { id: 'TKT-001', subject: 'Order not received after 7 days', customerName: 'KTM Fresh Mart', customerEmail: 'orders@ktmfresh.com', category: 'Order Issue', status: 'IN_PROGRESS', priority: 'HIGH', assignedTo: 'Sita Support', lastMessage: 'Checking with courier service for tracking update', messageCount: 4, createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'TKT-002', subject: 'Damaged product received', customerName: 'Bhaktapur Organics', customerEmail: 'info@bhaktapurorg.com', category: 'Product Quality', status: 'WAITING_CUSTOMER', priority: 'MEDIUM', assignedTo: 'Sita Support', lastMessage: 'Please share photos of the damaged product', messageCount: 3, createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'TKT-003', subject: 'Wholesale pricing inquiry', customerName: 'Lalitpur Grocery', customerEmail: 'buy@lalitpurgrocery.com', category: 'General Inquiry', status: 'OPEN', priority: 'LOW', assignedTo: 'Unassigned', lastMessage: 'Looking for bulk pricing on Basmati Rice', messageCount: 1, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'TKT-004', subject: 'Refund request for cancelled order', customerName: 'Chitwan Fresh Direct', customerEmail: 'order@chitwanfresh.com', category: 'Refund', status: 'RESOLVED', priority: 'MEDIUM', assignedTo: 'Sita Support', lastMessage: 'Refund processed successfully', messageCount: 6, createdAt: new Date(Date.now() - 518400000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString(), resolvedAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'TKT-005', subject: 'Account access issue', customerName: 'Pokhara Organics Co.', customerEmail: 'deepak@pokharaorganics.com', category: 'Account', status: 'OPEN', priority: 'URGENT', assignedTo: 'Sita Support', lastMessage: 'Cannot login to wholesale portal', messageCount: 2, createdAt: new Date(Date.now() - 14400000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
];

const STATUS_VARIANT: Record<TicketStatus, string> = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  WAITING_CUSTOMER: 'neutral',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const PRIORITY_VARIANT: Record<TicketPriority, string> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

/** Screen: Customer Support
 *  Can view: SUPER_ADMIN, ADMIN, CUSTOMER_SUPPORT
 *  Can manage: SUPER_ADMIN, ADMIN, CUSTOMER_SUPPORT
 */
export default function SupportPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignDialog, setAssignDialog] = useState<SupportTicket | null>(null);
  const [resolveDialog, setResolveDialog] = useState<SupportTicket | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const canManage = user && canAct(user.role, 'support:manage');

  const filteredTickets = MOCK_TICKETS.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleResolve = async () => {
    if (!resolveDialog) return;
    addToast({
      type: 'success',
      title: 'Ticket resolved',
      description: `${resolveDialog.subject} has been marked as resolved.`,
    });
    setResolveDialog(null);
    setResolveNote('');
  };

  const handleAssign = async () => {
    if (!assignDialog) return;
    addToast({
      type: 'success',
      title: 'Ticket assigned',
      description: `${assignDialog.subject} has been assigned.`,
    });
    setAssignDialog(null);
  };

  const columns = useMemo<ColumnDef<SupportTicket>[]>(() => [
    {
      accessorKey: 'subject',
      header: 'Ticket',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-surface-900">{row.original.subject}</p>
          <p className="text-2xs text-surface-400">{row.original.id} • {row.original.category}</p>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-surface-700">{row.original.customerName}</p>
          <p className="text-2xs text-surface-400">{row.original.customerEmail}</p>
        </div>
      ),
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => (
        <Badge variant={(PRIORITY_VARIANT[row.original.priority] ?? 'neutral') as any}>
          {row.original.priority}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={(STATUS_VARIANT[row.original.status] ?? 'neutral') as any} dot>
          {row.original.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: 'assignedTo',
      header: 'Assigned To',
      cell: ({ row }) => (
        <span className="text-sm text-surface-600">{row.original.assignedTo}</span>
      ),
    },
    {
      accessorKey: 'messageCount',
      header: 'Messages',
      cell: ({ row }) => (
        <span className="tabular-nums text-surface-600">{row.original.messageCount}</span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Last Update',
      cell: ({ row }) => (
        <span className="text-xs text-surface-500">{relativeTime(row.original.updatedAt)}</span>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions' as const,
            header: '' as const,
            size: 150,
            cell: ({ row }: { row: any }) => {
              const ticket = row.original as SupportTicket;
              return (
                <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => setResolveDialog(ticket)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAssignDialog(ticket)}>
                        Assign
                      </Button>
                    </>
                  )}
                </div>
              );
            },
          },
        ]
      : []),
  ], [canManage]);

  const statusTabs = [
    { id: '', label: 'All' },
    { id: 'OPEN', label: 'Open' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'WAITING_CUSTOMER', label: 'Waiting' },
    { id: 'RESOLVED', label: 'Resolved' },
  ];

  // Stats
  const openCount = MOCK_TICKETS.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = MOCK_TICKETS.filter((t) => t.status === 'IN_PROGRESS').length;
  const urgentCount = MOCK_TICKETS.filter((t) => t.priority === 'URGENT' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Support"
        description="Manage support tickets and customer communications"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Support' }]}
        actions={
          canManage ? (
            <Button>
              <Plus className="h-4 w-4" /> New Ticket
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Open</p>
              <p className="text-2xl font-bold text-amber-600">{openCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
            </div>
          </div>
        </Card>
        <Card className={urgentCount > 0 ? 'border-red-200 bg-red-50/50' : ''}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Urgent</p>
              <p className="text-2xl font-bold text-red-600">{urgentCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Total Tickets</p>
              <p className="text-2xl font-bold text-surface-900">{MOCK_TICKETS.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={filteredTickets}
        isLoading={false}
        searchPlaceholder="Search tickets by subject, customer…"
        emptyState={
          <EmptyState
            icon={Headphones}
            title="No support tickets"
            description="Customer support tickets will appear here."
          />
        }
      />

      {/* Resolve Dialog */}
      {resolveDialog && (
        <Dialog
          open={!!resolveDialog}
          onClose={() => { setResolveDialog(null); setResolveNote(''); }}
          title="Resolve ticket?"
          description="Mark this ticket as resolved and close it."
          primaryAction={{
            label: 'Mark as Resolved',
            onClick: handleResolve,
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-3 text-sm">
              <p><span className="font-medium">Subject:</span> {resolveDialog.subject}</p>
              <p><span className="font-medium">Customer:</span> {resolveDialog.customerName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700">Resolution Note</label>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Describe how this issue was resolved…"
                className="mt-1 w-full h-20 rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
          </div>
        </Dialog>
      )}

      {/* Assign Dialog */}
      {assignDialog && (
        <Dialog
          open={!!assignDialog}
          onClose={() => setAssignDialog(null)}
          title="Assign ticket"
          description="Assign this ticket to a support agent"
          primaryAction={{
            label: 'Assign',
            onClick: handleAssign,
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-3 text-sm">
              <p><span className="font-medium">Subject:</span> {assignDialog.subject}</p>
              <p><span className="font-medium">Customer:</span> {assignDialog.customerName}</p>
            </div>
            <Select
              label="Assign to"
              value=""
              onChange={() => {}}
              options={[
                { value: 'sita', label: 'Sita Support' },
                { value: 'ram', label: 'Ram Sales' },
                { value: 'gita', label: 'Gita Manager' },
              ]}
              placeholder="Select an agent…"
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
