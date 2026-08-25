// ─── Wholesale / Business Types ───────────────────────────────────────

export type BusinessStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type WholesalePriceTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export interface Business {
  id: string;
  businessName: string;
  registrationNumber?: string;
  taxId?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  status: BusinessStatus;
  priceTier?: WholesalePriceTier;
  creditLimit?: number;
  paymentTerms?: string;
  assignedSalesId?: string;
  assignedSalesName?: string;
  orderCount: number;
  totalSpend: number;
  notes?: string;
  rejectionReason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteRequest {
  id: string;
  businessId: string;
  businessName: string;
  items: QuoteItem[];
  notes?: string;
  status: 'PENDING' | 'RESPONDED' | 'ACCEPTED' | 'EXPIRED';
  respondedAt?: string;
  responseNote?: string;
  totalEstimate?: number;
  createdAt: string;
}

export interface QuoteItem {
  productId: string;
  productName: string;
  quantity: number;
  estimatedUnitPrice?: number;
}

export interface BusinessActionRequest {
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
  priceTier?: WholesalePriceTier;
}

export interface BusinessListParams {
  status?: BusinessStatus;
  search?: string;
  priceTier?: WholesalePriceTier;
  page?: number;
  limit?: number;
}
