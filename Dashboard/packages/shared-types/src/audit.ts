// ─── Audit Log Types ──────────────────────────────────────────────────

export type AuditEntityType =
  | 'ORDER'
  | 'PRODUCT'
  | 'INVENTORY'
  | 'BATCH'
  | 'BUSINESS'
  | 'CUSTOMER'
  | 'REVIEW'
  | 'USER'
  | 'SETTINGS';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'APPROVE'
  | 'REJECT'
  | 'RECALL'
  | 'ADJUST'
  | 'LOGIN'
  | 'LOGOUT';

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogListParams {
  entityType?: AuditEntityType;
  action?: AuditAction;
  actorId?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}
