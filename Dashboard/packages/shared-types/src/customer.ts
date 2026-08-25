// ─── Customer Types ───────────────────────────────────────────────────

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: CustomerStatus;
  orderCount: number;
  totalSpent: number;
  lastOrderDate?: string;
  addresses: CustomerAddress[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  content: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface CustomerListParams {
  status?: CustomerStatus;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
