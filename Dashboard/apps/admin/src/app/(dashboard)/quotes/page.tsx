'use client';

import React, { useState } from 'react';
import { useQuotes, useRespondToQuote } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import type { QuoteRequest } from '@aamako/shared-types';
import { MessageSquareQuote, Send, CheckCircle2, Clock } from 'lucide-react';

/** Screen: Quotes
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, SALES
 *  Can respond: SALES, ADMIN, SUPER_ADMIN
 */
export default function QuotesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [respondDialog, setRespondDialog] = useState<QuoteRequest | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [estimatedTotal, setEstimatedTotal] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const canRespond = user && canAct(user.role, 'quotes:respond');
  const respondMutation = useRespondToQuote();

  const { data: quotes, isLoading } = useQuotes();

  const filteredQuotes = (quotes ?? []).filter((q) => {
    if (statusFilter && q.status !== statusFilter) return false;
    return true;
  });

  const handleRespond = async () => {
    if (!respondDialog) return;
    setIsResponding(true);
    try {
      await respondMutation.mutateAsync({
        id: respondDialog.id,
        note: responseNote,
        estimatedTotal: estimatedTotal ? parseFloat(estimatedTotal) : undefined,
      });
      addToast({
        type: 'success',
        title: 'Quote responded',
        description: `Response sent to ${respondDialog.businessName}`,
      });
      setRespondDialog(null);
      setResponseNote('');
      setEstimatedTotal('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to respond', description: err.message });
    } finally {
      setIsResponding(false);
    }
  };

  const tabs = [
    { id: '', label: 'All' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'RESPONDED', label: 'Responded' },
    { id: 'ACCEPTED', label: 'Accepted' },
    { id: 'EXPIRED', label: 'Expired' },
  ];

  const STATUS_VARIANT: Record<string, string> = {
    PENDING: 'warning',
    RESPONDED: 'info',
    ACCEPTED: 'success',
    EXPIRED: 'danger',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        description="Manage wholesale quote requests"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quotes' }]}
      />

      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      {filteredQuotes.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="No quote requests"
          description="Quote requests from wholesale customers will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotes.map((quote) => (
            <Card key={quote.id}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-surface-900">{quote.businessName}</h3>
                    <p className="text-xs text-surface-500">{relativeTime(quote.createdAt)}</p>
                  </div>
                  <Badge variant={(STATUS_VARIANT[quote.status] ?? 'neutral') as any} dot>
                    {quote.status}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  {quote.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-surface-600">{item.productName}</span>
                      <span className="tabular-nums text-surface-900">{item.quantity} units</span>
                    </div>
                  ))}
                </div>

                {quote.notes && (
                  <p className="text-xs text-surface-500 mb-3 italic">"{quote.notes}"</p>
                )}

                {quote.totalEstimate && (
                  <div className="flex items-center justify-between pt-3 border-t border-surface-100">
                    <span className="text-sm font-medium text-surface-700">Estimated Total</span>
                    <span className="text-sm font-semibold text-surface-900 tabular-nums">
                      {formatCurrency(quote.totalEstimate)}
                    </span>
                  </div>
                )}

                {canRespond && quote.status === 'PENDING' && (
                  <div className="mt-4 pt-3 border-t border-surface-100">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => setRespondDialog(quote)}
                    >
                      <Send className="h-4 w-4" /> Respond to Quote
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Respond Dialog */}
      {respondDialog && (
        <Dialog
          open={!!respondDialog}
          onClose={() => {
            setRespondDialog(null);
            setResponseNote('');
            setEstimatedTotal('');
          }}
          title={`Respond to ${respondDialog.businessName}`}
          description="Provide pricing and notes for this quote request"
          primaryAction={{
            label: 'Send Response',
            onClick: handleRespond,
            isLoading: isResponding,
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-3 text-sm">
              <p className="font-medium mb-2">Quote Items:</p>
              {respondDialog.items.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span>{item.productName}</span>
                  <span>{item.quantity} units</span>
                </div>
              ))}
            </div>

            <Input
              label="Estimated Total (NPR)"
              type="number"
              value={estimatedTotal}
              onChange={(e) => setEstimatedTotal(e.target.value)}
              placeholder="Enter total estimated price"
            />

            <div>
              <label className="text-sm font-medium text-surface-700">Response Note</label>
              <textarea
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder="Provide details about pricing, availability, delivery timeline…"
                className="mt-1 w-full h-24 rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
