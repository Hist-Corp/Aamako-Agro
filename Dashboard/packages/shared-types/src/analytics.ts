// ─── Analytics Types ──────────────────────────────────────────────────

export type DateRange = '7d' | '30d' | '90d' | '1y' | 'custom';

export interface OverviewKPIs {
  ordersToday: number;
  ordersTodayChange: number;
  revenueToday: number;
  revenueTodayChange: number;
  pendingWholesaleApprovals: number;
  lowStockAlerts: number;
  openQuotes: number;
  pendingReviews: number;
  totalCustomers: number;
  activeProducts: number;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface SalesReport {
  dataPoints: SalesDataPoint[];
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueChange: number;
  ordersChange: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalSold: number;
  revenue: number;
  imageUrl?: string;
}

export interface ChannelSplit {
  retail: { orders: number; revenue: number };
  wholesale: { orders: number; revenue: number };
}

export interface FulfillmentPipeline {
  pending: number;
  confirmed: number;
  processing: number;
  readyToShip: number;
  shipped: number;
  deliveredToday: number;
}

export interface ActivityFeedItem {
  id: string;
  type: 'order' | 'wholesale' | 'inventory' | 'review' | 'batch';
  message: string;
  actor?: string;
  entityId?: string;
  entityType?: string;
  timestamp: string;
}

export interface SalesReportParams {
  range: DateRange;
  dateFrom?: string;
  dateTo?: string;
}
