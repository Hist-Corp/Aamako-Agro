'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useSupportTickets, useCreateTicket, useUpdateTicket } from '@/lib/api-hooks';
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
import type { SupportTicket, TicketStatus, TicketPriority } from '@aamako/shared-types';
import { Headphones, MessageSquare, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

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
  URGENCY: 'danger',
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
  const [assignAgent, setAssignAgent] = useState('');
  const [newTicketDialog, setNewTicketDialog] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', customerName: '', customerEmail: '', category: 'General Inquiry', priority: 'MEDIUM' as TicketPriority });

  const canManage = user && canAct(user.role, 'support:manage');
  const { data: ticketsData, isLoading } = useSupportTickets({
    status: (statusFilter as TicketStatus) || undefined,
    priority: (priorityFilter as TicketPriority) || undefined,
  });
  const createMutation = useCreateTicket();
  const updateMutation = useUpdateTicket();

  const tickets = ticketsData ?? [];

  const handleResolve = async () => {
    if (!resolveDialog) return;
    try {
      await updateMutation.mutateAsync({
        id: resolveDialog.id,
        data: {
          status: 'RESOLVED',
          message: resolveNote.trim() || undefined,
        },
      });
      addToast({
        type: 'success',
        title: 'Ticket resolved',
        description: `${resolveDialog.subject} has been marked as resolved.`,
      });
      setResolveDialog(null);
      setResolveNote('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Resolve failed', description: err.message });
    }
  };

  const handleAssign = async () => {
    if (!assignDialog) return;
    if (!assignAgent) {
      addToast({ type: 'error', title: 'No agent selected', description: 'Choose an agent to assign this ticket to.' });
      return;
    }
    const agentName = { sita: 'Sita Support', ram: 'Ram Sales', gita: 'Gita Manager' }[assignAgent] ?? assignAgent;
    try {
      await updateMutation.mutateAsync({
        id: assignDialog.id,
        data: {
          assignedTo: agentName,
          status: assignDialog.status === 'OPEN' ? 'IN_PROGRESS' : undefined,
        },
      });
      addToast({
        type: 'success',
        title: 'Ticket assigned',
        description: `${assignDialog.subject} has been assigned to ${agentName}.`,
      });
      setAssignDialog(null);
      setAssignAgent('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Assignment failed', description: err.message });
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.customerName.trim()) {
      addToast({ type: 'error', title: 'Missing fields', description: 'Subject and customer name are required.' });
      return;
    }
    try {
      await createMutation.mutateAsync({
        subject: newTicket.subject.trim(),
        customerName: newTicket.customerName.trim(),
        customerEmail: newTicket.customerEmail.trim() || undefined,
        category: newTicket.category,
        priority: newTicket.priority,
        message: 'Ticket created',
      });
      addToast({
        type: 'success',
        title: 'Ticket created',
        description: `${newTicket.subject} has been added to the queue.`,
      });
      setNewTicketDialog(false);
      setNewTicket({ subject: '', customerName: '', customerEmail: '', category: 'General Inquiry', priority: 'MEDIUM' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Creation failed', description: err.message });
    }
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
  const openCount = tickets.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const urgentCount = tickets.filter((t) => t.priority === 'URGENCY' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Support"
        description="Manage support tickets and customer communications"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Support' }]}
        actions={
          canManage ? (
            <Button onClick={() => setNewTicketDialog(true)}>
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
              <p className="text-2xl font-bold text-surface-900">{tickets.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={tickets}
        isLoading={isLoading}
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
              value={assignAgent}
              onChange={(e) => setAssignAgent(e.target.value)}
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

      {/* New Ticket Dialog */}
      {newTicketDialog && (
        <Dialog
          open={newTicketDialog}
          onClose={() => setNewTicketDialog(false)}
          title="New support ticket"
          description="Create a ticket to track a customer issue."
          primaryAction={{
            label: 'Create Ticket',
            onClick: handleCreateTicket,
          }}
        >
          <div className="space-y-4">
            <Input
              label="Subject *"
              value={newTicket.subject}
              onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              placeholder="Short summary of the issue"
            />
            <Input
              label="Customer name *"
              value={newTicket.customerName}
              onChange={(e) => setNewTicket({ ...newTicket, customerName: e.target.value })}
              placeholder="e.g. KTM Fresh Mart"
            />
            <Input
              label="Customer email"
              type="email"
              value={newTicket.customerEmail}
              onChange={(e) => setNewTicket({ ...newTicket, customerEmail: e.target.value })}
              placeholder="customer@email.com"
            />
            <Select
              label="Category"
              value={newTicket.category}
              onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
              options={[
                { value: 'General Inquiry', label: 'General Inquiry' },
                { value: 'Order Issue', label: 'Order Issue' },
                { value: 'Product Quality', label: 'Product Quality' },
                { value: 'Refund', label: 'Refund' },
                { value: 'Account', label: 'Account' },
              ]}
            />
            <Select
              label="Priority"
              value={newTicket.priority}
              onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as TicketPriority })}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'URGENT', label: 'Urgent' },
              ]}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
