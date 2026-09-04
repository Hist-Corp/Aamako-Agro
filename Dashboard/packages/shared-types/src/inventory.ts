// ─── Inventory Types ──────────────────────────────────────────────────

export type AdjustmentReason =
  | 'RECEIVED'
  | 'SOLD'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'RECALLED'
  | 'CORRECTION'
  | 'CYCLE_COUNT'
  | 'RETURN'
  | 'TRANSFER';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  isActive: boolean;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  warehouseId: string;
  warehouseName: string;
  batchId?: string;
  batchNumber?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  unit: string;
  lastCountedAt?: string;
  updatedAt: string;
}

export interface InventoryAdjustment {
  id: string;
  inventoryItemId: string;
  productName: string;
  warehouseName: string;
  previousQuantity: number;
  newQuantity: number;
  adjustment: number;
  reason: AdjustmentReason;
  reasonNote?: string;
  batchId?: string;
  batchNumber?: string;
  adjustedBy: string;
  adjustedByName: string;
  createdAt: string;
}

export interface InventoryAdjustmentRequest {
  inventoryItemId: string;
  adjustment: number;
  reason: AdjustmentReason;
  reasonNote: string;
}

export interface InventoryListParams {
  warehouseId?: string;
  search?: string;
  lowStock?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
