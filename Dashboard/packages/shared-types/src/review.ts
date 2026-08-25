// ─── Review Types ─────────────────────────────────────────────────────

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

export interface Review {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  rating: number;
  title?: string;
  content: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  flagReason?: string;
  moderatedBy?: string;
  moderatedByName?: string;
  moderatedAt?: string;
  images?: ReviewImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewImage {
  id: string;
  url: string;
}

export interface ReviewModerationRequest {
  status: 'APPROVED' | 'REJECTED' | 'FLAGGED';
  reason?: string;
}

export interface ReviewListParams {
  productId?: string;
  status?: ReviewStatus;
  rating?: number;
  search?: string;
  page?: number;
  limit?: number;
}
