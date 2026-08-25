// ─── Batch & Recall Types ─────────────────────────────────────────────

export type QcStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'QUARANTINED';
export type RecallStatus = 'NONE' | 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED';
export type RecallSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Batch {
  id: string;
  batchNumber: string;
  productId: string;
  productName: string;
  productionDate: string;
  expiryDate: string;
  quantity: number;
  remainingQuantity: number;
  qcStatus: QcStatus;
  recallStatus: RecallStatus;
  supplier?: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecallRequest {
  batchId: string;
  severity: RecallSeverity;
  reason: string;
  notifyAffectedCustomers: boolean;
}

export interface RecallImpact {
  batchId: string;
  batchNumber: string;
  affectedInventoryCount: number;
  affectedOrderCount: number;
  affectedCustomerCount: number;
  affectedCustomers: RecallAffectedCustomer[];
  affectedOrders: RecallAffectedOrder[];
  affectedInventory: RecallAffectedInventory[];
}

export interface RecallAffectedCustomer {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  lastOrderDate: string;
}

export interface RecallAffectedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  quantity: number;
  status: string;
  orderedAt: string;
}

export interface RecallAffectedInventory {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

export interface BatchListParams {
  productId?: string;
  qcStatus?: QcStatus;
  recallStatus?: RecallStatus;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
}
