// ─── API Hooks ────────────────────────────────────────────────────────
// TanStack Query hooks for every admin endpoint.
// Each hook tries the real backend first; falls back to mock data for demo mode.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';
import type {
  OverviewKPIs,
  ActivityFeedItem,
  FulfillmentPipeline,
  Order,
  OrderStatus,
  PaymentStatus,
  OrderListParams,
  PaginatedResponse,
  Product,
  InventoryItem,
  InventoryAdjustmentRequest,
  InventoryListParams,
  Batch,
  BatchListParams,
  RecallImpact,
  RecallRequest,
  Business,
  BusinessListParams,
  BusinessActionRequest,
  QuoteRequest,
  Customer,
  CustomerListParams,
  Review,
  ReviewListParams,
  ReviewModerationRequest,
  AuditLog,
  AuditLogListParams,
  SalesReport,
  SalesReportParams,
  User,
  Role,
} from '@aamako/shared-types';

// ─── Query Keys ─────────────────────────────────────────────────────
export const queryKeys = {
  overview: ['admin', 'overview'] as const,
  activityFeed: ['admin', 'activity-feed'] as const,
  pipeline: ['admin', 'pipeline'] as const,
  orders: (params?: OrderListParams) => ['admin', 'orders', params] as const,
  order: (id: string) => ['admin', 'orders', id] as const,
  products: ['admin', 'products'] as const,
  product: (id: string) => ['admin', 'products', id] as const,
  inventory: (params?: InventoryListParams) => ['admin', 'inventory', params] as const,
  batches: (params?: BatchListParams) => ['admin', 'batches', params] as const,
  batch: (id: string) => ['admin', 'batches', id] as const,
  recallImpact: (batchId: string) => ['admin', 'recall-impact', batchId] as const,
  businesses: (params?: BusinessListParams) => ['admin', 'businesses', params] as const,
  business: (id: string) => ['admin', 'businesses', id] as const,
  quotes: ['admin', 'quotes'] as const,
  customers: (params?: CustomerListParams) => ['admin', 'customers', params] as const,
  customer: (id: string) => ['admin', 'customers', id] as const,
  reviews: (params?: ReviewListParams) => ['admin', 'reviews', params] as const,
  auditLogs: (params?: AuditLogListParams) => ['admin', 'audit-logs', params] as const,
  salesReport: (params: SalesReportParams) => ['admin', 'reports', 'sales', params] as const,
  users: ['admin', 'users'] as const,
} as const;

// ─── Mock Data ──────────────────────────────────────────────────────

const MOCK_OVERVIEW: OverviewKPIs = {
  ordersToday: 47,
  ordersTodayChange: 12.5,
  revenueToday: 284750,
  revenueTodayChange: 8.3,
  pendingWholesaleApprovals: 5,
  lowStockAlerts: 3,
  openQuotes: 8,
  pendingReviews: 12,
  totalCustomers: 342,
  activeProducts: 156,
};

const MOCK_PIPELINE: FulfillmentPipeline = {
  pending: 12,
  confirmed: 8,
  processing: 15,
  readyToShip: 6,
  shipped: 4,
  deliveredToday: 22,
};

const MOCK_ACTIVITIES: ActivityFeedItem[] = [
  { id: '1', type: 'order', message: 'New order #ORD-2847 from KTM Fresh Mart — Rs. 12,400', timestamp: new Date(Date.now() - 300000).toISOString(), actor: 'System' },
  { id: '2', type: 'wholesale', message: 'Wholesale application from Pokhara Organic Co. pending review', timestamp: new Date(Date.now() - 900000).toISOString(), actor: 'System' },
  { id: '3', type: 'inventory', message: 'Low stock alert: Basmati Rice (5kg) — 15 units remaining', timestamp: new Date(Date.now() - 1800000).toISOString(), actor: 'Inventory System' },
  { id: '4', type: 'review', message: 'New 5-star review on Turmeric Powder (250g) by Ram S.', timestamp: new Date(Date.now() - 3600000).toISOString(), actor: 'System' },
  { id: '5', type: 'batch', message: 'Batch #BAT-0092 QC check completed — Passed', timestamp: new Date(Date.now() - 7200000).toISOString(), actor: 'Sita K.' },
  { id: '6', type: 'order', message: 'Order #ORD-2841 shipped via Pathao Courier', timestamp: new Date(Date.now() - 10800000).toISOString(), actor: 'Hari P.' },
  { id: '7', type: 'inventory', message: 'Stock adjustment: +200 units Mustard Oil (1L) — Restocked', timestamp: new Date(Date.now() - 14400000).toISOString(), actor: 'Gita M.' },
  { id: '8', type: 'wholesale', message: 'Wholesale account approved: Lalitpur Wholesale Hub', timestamp: new Date(Date.now() - 18000000).toISOString(), actor: 'Admin' },
];

const MOCK_ORDERS: Order[] = [
  { id: 'ORD-2847', orderNumber: 'ORD-2847', customerId: 'C001', customerName: 'KTM Fresh Mart', customerEmail: 'orders@ktmfresh.com', status: 'PENDING', channel: 'RETAIL', itemCount: 2, subtotal: 11300, tax: 1100, shippingCost: 0, total: 12400, currency: 'NPR', shippingAddress: { line1: 'New Road, Kathmandu', city: 'Kathmandu', state: 'Bagmati', postalCode: '44600', country: 'Nepal' }, items: [{ id: 'OI-001', productId: 'P001', productName: 'Basmati Rice (5kg)', quantity: 10, unitPrice: 850, totalPrice: 8500, batchId: 'BAT-0090' }, { id: 'OI-002', productId: 'P003', productName: 'Turmeric Powder (250g)', quantity: 20, unitPrice: 195, totalPrice: 3900, batchId: 'BAT-0088' }], paymentStatus: 'PAID', createdAt: new Date(Date.now() - 300000).toISOString(), updatedAt: new Date(Date.now() - 300000).toISOString() },
  { id: 'ORD-2846', orderNumber: 'ORD-2846', customerId: 'C002', customerName: 'Bhaktapur Organics', customerEmail: 'info@bhaktapurorg.com', status: 'CONFIRMED', channel: 'RETAIL', itemCount: 1, subtotal: 8000, tax: 750, shippingCost: 0, total: 8750, currency: 'NPR', shippingAddress: { line1: 'Durbar Area, Bhaktapur', city: 'Bhaktapur', state: 'Bagmati', postalCode: '44800', country: 'Nepal' }, items: [{ id: 'OI-003', productId: 'P002', productName: 'Mustard Oil (1L)', quantity: 15, unitPrice: 320, totalPrice: 4800, batchId: 'BAT-0091' }], paymentStatus: 'PAID', createdAt: new Date(Date.now() - 1800000).toISOString(), updatedAt: new Date(Date.now() - 900000).toISOString() },
  { id: 'ORD-2845', orderNumber: 'ORD-2845', customerId: 'C003', customerName: 'Lalitpur Grocery', customerEmail: 'buy@lalitpurgrocery.com', status: 'PROCESSING', channel: 'WHOLESALE', itemCount: 2, subtotal: 22600, tax: 0, shippingCost: 0, total: 22100, currency: 'NPR', shippingAddress: { line1: 'Patan Dhoka, Lalitpur', city: 'Lalitpur', state: 'Bagmati', postalCode: '44700', country: 'Nepal' }, items: [{ id: 'OI-004', productId: 'P001', productName: 'Basmati Rice (5kg)', quantity: 20, unitPrice: 850, totalPrice: 17000, batchId: 'BAT-0090' }, { id: 'OI-005', productId: 'P004', productName: 'Red Lentils (1kg)', quantity: 25, unitPrice: 240, totalPrice: 6000, batchId: 'BAT-0089' }], paymentStatus: 'PAID', createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 'ORD-2844', orderNumber: 'ORD-2844', customerId: 'C004', customerName: 'Chitwan Fresh Direct', customerEmail: 'order@chitwanfresh.com', status: 'READY_TO_SHIP', channel: 'RETAIL', itemCount: 1, subtotal: 5200, tax: 400, shippingCost: 0, total: 5600, currency: 'NPR', shippingAddress: { line1: 'Bharatpur Main Rd', city: 'Bharatpur', state: 'Chitwan', postalCode: '44200', country: 'Nepal' }, items: [{ id: 'OI-006', productId: 'P005', productName: 'Cumin Seeds (500g)', quantity: 10, unitPrice: 280, totalPrice: 2800, batchId: 'BAT-0087' }], paymentStatus: 'PAID', createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'ORD-2843', orderNumber: 'ORD-2843', customerId: 'C005', customerName: 'Pokhara Organics Co.', customerEmail: 'deepak@pokharaorganics.com', status: 'SHIPPED', channel: 'WHOLESALE', itemCount: 2, subtotal: 31350, tax: 0, shippingCost: 2850, total: 34200, currency: 'NPR', shippingAddress: { line1: 'Lakeside, Pokhara', city: 'Pokhara', state: 'Gandaki', postalCode: '33700', country: 'Nepal' }, items: [{ id: 'OI-007', productId: 'P001', productName: 'Basmati Rice (5kg)', quantity: 30, unitPrice: 850, totalPrice: 25500, batchId: 'BAT-0090' }, { id: 'OI-008', productId: 'P003', productName: 'Turmeric Powder (250g)', quantity: 30, unitPrice: 195, totalPrice: 5850, batchId: 'BAT-0088' }], paymentStatus: 'PAID', createdAt: new Date(Date.now() - 14400000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'ORD-2842', orderNumber: 'ORD-2842', customerId: 'C006', customerName: 'Nepal Food Supplies', customerEmail: 'ops@nepalfood.com', status: 'DELIVERED', channel: 'WHOLESALE', itemCount: 1, subtotal: 15000, tax: 0, shippingCost: 800, total: 15800, currency: 'NPR', shippingAddress: { line1: 'Tripureshwor, Kathmandu', city: 'Kathmandu', state: 'Bagmati', postalCode: '44600', country: 'Nepal' }, items: [{ id: 'OI-009', productId: 'P002', productName: 'Mustard Oil (1L)', quantity: 25, unitPrice: 320, totalPrice: 8000, batchId: 'BAT-0091' }], paymentStatus: 'PAID', createdAt: new Date(Date.now() - 28800000).toISOString(), updatedAt: new Date(Date.now() - 14400000).toISOString(), deliveredAt: new Date(Date.now() - 14400000).toISOString() },
  { id: 'ORD-2841', orderNumber: 'ORD-2841', customerId: 'C007', customerName: 'Biratnagar Traders', customerEmail: 'kamal@biratnagartraders.com', status: 'DELIVERED', channel: 'RETAIL', itemCount: 2, subtotal: 9900, tax: 0, shippingCost: 0, total: 9900, currency: 'NPR', shippingAddress: { line1: 'Main Road, Biratnagar', city: 'Biratnagar', state: 'Morang', postalCode: '56600', country: 'Nepal' }, items: [{ id: 'OI-010', productId: 'P004', productName: 'Red Lentils (1kg)', quantity: 15, unitPrice: 240, totalPrice: 3600, batchId: 'BAT-0089' }, { id: 'OI-011', productId: 'P005', productName: 'Cumin Seeds (500g)', quantity: 15, unitPrice: 280, totalPrice: 4200, batchId: 'BAT-0087' }], paymentStatus: 'PAID', createdAt: new Date(Date.now() - 43200000).toISOString(), updatedAt: new Date(Date.now() - 28800000).toISOString(), deliveredAt: new Date(Date.now() - 28800000).toISOString() },
  { id: 'ORD-2840', orderNumber: 'ORD-2840', customerId: 'C001', customerName: 'KTM Fresh Mart', customerEmail: 'orders@ktmfresh.com', status: 'CANCELLED', channel: 'RETAIL', itemCount: 1, subtotal: 4250, tax: 0, shippingCost: 0, total: 4250, currency: 'NPR', shippingAddress: { line1: 'New Road, Kathmandu', city: 'Kathmandu', state: 'Bagmati', postalCode: '44600', country: 'Nepal' }, items: [{ id: 'OI-012', productId: 'P001', productName: 'Basmati Rice (5kg)', quantity: 5, unitPrice: 850, totalPrice: 4250, batchId: 'BAT-0090' }], paymentStatus: 'REFUNDED', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 43200000).toISOString() },
];

const MOCK_PRODUCTS: Product[] = [
  { id: 'P001', name: 'Basmati Rice', slug: 'basmati-rice', description: 'Premium long-grain basmati rice sourced from the Terai region', categoryId: 'CAT-001', categoryName: 'Grains & Rice', status: 'ACTIVE', basePrice: 850, wholesalePriceTier1: 720, wholesalePriceTier2: 690, wholesalePriceTier3: 650, unit: '5kg', origin: 'Terai, Nepal', tags: ['rice', 'basmati', 'premium'], totalStock: 162, lowStockThreshold: 50, isFeatured: true, images: [], variants: [{ id: 'V001', name: '5kg Pack', price: 850, sku: 'BR-5KG', isActive: true, attributes: {} }], createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'P002', name: 'Mustard Oil', slug: 'mustard-oil', description: 'Cold-pressed mustard oil, traditional Nepali style', categoryId: 'CAT-002', categoryName: 'Oils & Condiments', status: 'ACTIVE', basePrice: 320, wholesalePriceTier1: 270, unit: '1L', origin: 'Kathmandu, Nepal', tags: ['oil', 'mustard', 'cold-pressed'], totalStock: 85, lowStockThreshold: 30, isFeatured: false, images: [], variants: [{ id: 'V002', name: '1L Bottle', price: 320, sku: 'MO-1L', isActive: true, attributes: {} }, { id: 'V003', name: '500ml Bottle', price: 170, sku: 'MO-500ML', isActive: true, attributes: {} }], createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'P003', name: 'Turmeric Powder', slug: 'turmeric-powder', description: 'Freshly ground turmeric powder from whole roots', categoryId: 'CAT-003', categoryName: 'Spices', status: 'ACTIVE', basePrice: 195, wholesalePriceTier1: 160, unit: '250g', origin: 'Terai, Nepal', tags: ['turmeric', 'spice', 'powder'], totalStock: 200, lowStockThreshold: 40, isFeatured: false, images: [], variants: [{ id: 'V004', name: '250g Pack', price: 195, sku: 'TP-250G', isActive: true, attributes: {} }], createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'P004', name: 'Red Lentils', slug: 'red-lentils', description: 'Premium masoor dal, cleaned and sorted', categoryId: 'CAT-004', categoryName: 'Pulses & Legumes', status: 'ACTIVE', basePrice: 240, wholesalePriceTier1: 200, unit: '1kg', origin: 'Terai, Nepal', tags: ['lentils', 'dal', 'masoor'], totalStock: 60, lowStockThreshold: 30, isFeatured: false, images: [], variants: [{ id: 'V005', name: '1kg Pack', price: 240, sku: 'RL-1KG', isActive: true, attributes: {} }], createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'P005', name: 'Cumin Seeds', slug: 'cumin-seeds', description: 'Whole cumin seeds, aromatic and fresh', categoryId: 'CAT-003', categoryName: 'Spices', status: 'ACTIVE', basePrice: 280, wholesalePriceTier1: 235, unit: '500g', origin: 'Western Nepal', tags: ['cumin', 'spice', 'seeds'], totalStock: 90, lowStockThreshold: 25, isFeatured: false, images: [], variants: [{ id: 'V006', name: '500g Pack', price: 280, sku: 'CS-500G', isActive: true, attributes: {} }], createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'P006', name: 'Jasmine Rice', slug: 'jasmine-rice', description: 'Fragrant jasmine rice from Eastern Nepal', categoryId: 'CAT-001', categoryName: 'Grains & Rice', status: 'DRAFT', basePrice: 780, wholesalePriceTier1: 660, unit: '5kg', origin: 'Eastern Nepal', tags: ['rice', 'jasmine'], totalStock: 0, lowStockThreshold: 50, isFeatured: false, images: [], variants: [{ id: 'V007', name: '5kg Pack', price: 780, sku: 'JR-5KG', isActive: true, attributes: {} }], createdAt: new Date(Date.now() - 864000000).toISOString(), updatedAt: new Date(Date.now() - 864000000).toISOString() },
];

const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'INV-001', productId: 'P001', productName: 'Basmati Rice (5kg)', warehouseId: 'WH001', warehouseName: 'Main Warehouse - Kathmandu', quantity: 150, reservedQuantity: 20, availableQuantity: 130, reorderLevel: 50, unit: 'packs', batchId: 'BAT-0090', batchNumber: 'BAT-0090', updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'INV-002', productId: 'P002', productName: 'Mustard Oil (1L)', warehouseId: 'WH001', warehouseName: 'Main Warehouse - Kathmandu', quantity: 85, reservedQuantity: 0, availableQuantity: 85, reorderLevel: 30, unit: 'bottles', batchId: 'BAT-0091', batchNumber: 'BAT-0091', updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'INV-003', productId: 'P003', productName: 'Turmeric Powder (250g)', warehouseId: 'WH001', warehouseName: 'Main Warehouse - Kathmandu', quantity: 200, reservedQuantity: 0, availableQuantity: 200, reorderLevel: 40, unit: 'packs', batchId: 'BAT-0088', batchNumber: 'BAT-0088', updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'INV-004', productId: 'P004', productName: 'Red Lentils (1kg)', warehouseId: 'WH001', warehouseName: 'Main Warehouse - Kathmandu', quantity: 15, reservedQuantity: 5, availableQuantity: 10, reorderLevel: 30, unit: 'packs', batchId: 'BAT-0089', batchNumber: 'BAT-0089', updatedAt: new Date(Date.now() - 43200000).toISOString() },
  { id: 'INV-005', productId: 'P005', productName: 'Cumin Seeds (500g)', warehouseId: 'WH002', warehouseName: 'Secondary Warehouse - Pokhara', quantity: 90, reservedQuantity: 0, availableQuantity: 90, reorderLevel: 25, unit: 'packs', batchId: 'BAT-0087', batchNumber: 'BAT-0087', updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'INV-006', productId: 'P001', productName: 'Basmati Rice (5kg)', warehouseId: 'WH002', warehouseName: 'Secondary Warehouse - Pokhara', quantity: 12, reservedQuantity: 0, availableQuantity: 12, reorderLevel: 20, unit: 'packs', batchId: 'BAT-0090', batchNumber: 'BAT-0090', updatedAt: new Date(Date.now() - 86400000).toISOString() },
];

const MOCK_BATCHES: Batch[] = [
  { id: 'BAT-0090', batchNumber: 'BAT-0090', productId: 'P001', productName: 'Basmati Rice (5kg)', productionDate: '2026-10-01', expiryDate: '2027-10-01', quantity: 500, remainingQuantity: 162, qcStatus: 'PASSED', recallStatus: 'NONE', supplier: 'Terai Agro Ltd', createdBy: 'U001', createdByName: 'Super Admin', createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'BAT-0091', batchNumber: 'BAT-0091', productId: 'P002', productName: 'Mustard Oil (1L)', productionDate: '2026-10-05', expiryDate: '2027-04-05', quantity: 300, remainingQuantity: 85, qcStatus: 'PASSED', recallStatus: 'NONE', supplier: 'Kathmandu Pressing Co', createdBy: 'U001', createdByName: 'Super Admin', createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'BAT-0088', batchNumber: 'BAT-0088', productId: 'P003', productName: 'Turmeric Powder (250g)', productionDate: '2026-09-15', expiryDate: '2027-09-15', quantity: 400, remainingQuantity: 200, qcStatus: 'PASSED', recallStatus: 'NONE', supplier: 'Terai Agro Ltd', createdBy: 'U002', createdByName: 'Gita Manager', createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'BAT-0089', batchNumber: 'BAT-0089', productId: 'P004', productName: 'Red Lentils (1kg)', productionDate: '2026-09-20', expiryDate: '2027-03-20', quantity: 200, remainingQuantity: 15, qcStatus: 'PASSED', recallStatus: 'NONE', supplier: 'Terai Agro Ltd', createdBy: 'U002', createdByName: 'Gita Manager', createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'BAT-0087', batchNumber: 'BAT-0087', productId: 'P005', productName: 'Cumin Seeds (500g)', productionDate: '2026-09-10', expiryDate: '2027-09-10', quantity: 250, remainingQuantity: 90, qcStatus: 'PASSED', recallStatus: 'NONE', supplier: 'Western Spice Co', createdBy: 'U002', createdByName: 'Gita Manager', createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'BAT-0085', batchNumber: 'BAT-0085', productId: 'P007', productName: 'Coriander Seeds (200g)', productionDate: '2026-08-01', expiryDate: '2027-02-01', quantity: 100, remainingQuantity: 100, qcStatus: 'FAILED', recallStatus: 'NONE', supplier: 'Local Supplier', createdBy: 'U001', createdByName: 'Super Admin', createdAt: new Date(Date.now() - 5184000000).toISOString(), updatedAt: new Date(Date.now() - 4320000000).toISOString() },
];

const MOCK_BUSINESSES: Business[] = [
  { id: 'BIZ-001', businessName: 'KTM Fresh Mart', contactName: 'Anil Sharma', contactEmail: 'anil@ktmfresh.com', contactPhone: '+977-9841234567', status: 'APPROVED', priceTier: 'TIER_2', address: { line1: 'New Baneshwor', city: 'Kathmandu', state: 'Bagmati', postalCode: '44600', country: 'Nepal' }, orderCount: 45, totalSpend: 562000, createdAt: new Date(Date.now() - 5184000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'BIZ-002', businessName: 'Pokhara Organics Co.', contactName: 'Deepak Gurung', contactEmail: 'deepak@pokharaorganics.com', contactPhone: '+977-9851234567', status: 'APPROVED', priceTier: 'TIER_1', address: { line1: 'Lakeside', city: 'Pokhara', state: 'Gandaki', postalCode: '33700', country: 'Nepal' }, orderCount: 23, totalSpend: 340000, createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'BIZ-003', businessName: 'Bhaktapur Organics', contactName: 'Sunita Maharjan', contactEmail: 'sunita@bhaktapurorg.com', contactPhone: '+977-9861234567', status: 'PENDING', address: { line1: 'Durbar Area', city: 'Bhaktapur', state: 'Bagmati', postalCode: '44800', country: 'Nepal' }, orderCount: 0, totalSpend: 0, createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date(Date.now() - 604800000).toISOString() },
  { id: 'BIZ-004', businessName: 'Chitwan Fresh Direct', contactName: 'Rajesh Thapa', contactEmail: 'rajesh@chitwanfresh.com', contactPhone: '+977-9871234567', status: 'APPROVED', priceTier: 'TIER_2', address: { line1: 'Bharatpur Main Rd', city: 'Bharatpur', state: 'Chitwan', postalCode: '44200', country: 'Nepal' }, orderCount: 18, totalSpend: 215000, createdAt: new Date(Date.now() - 1296000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'BIZ-005', businessName: 'Biratnagar Traders', contactName: 'Kamal Shah', contactEmail: 'kamal@biratnagartraders.com', contactPhone: '+977-9881234567', status: 'REJECTED', address: { line1: 'Main Road', city: 'Biratnagar', state: 'Morang', postalCode: '56600', country: 'Nepal' }, orderCount: 0, totalSpend: 0, createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date(Date.now() - 259200000).toISOString() },
];

const MOCK_CUSTOMERS: Customer[] = [
  { id: 'C001', name: 'KTM Fresh Mart', email: 'orders@ktmfresh.com', phone: '+977-9841234567', status: 'ACTIVE', orderCount: 45, totalSpent: 562000, addresses: [{ id: 'A001', label: 'Main', line1: 'New Road', city: 'Kathmandu', state: 'Bagmati', postalCode: '44600', country: 'Nepal', isDefault: true }], createdAt: new Date(Date.now() - 5184000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'C002', name: 'Bhaktapur Organics', email: 'info@bhaktapurorg.com', phone: '+977-9861234567', status: 'ACTIVE', orderCount: 12, totalSpent: 156000, addresses: [{ id: 'A002', label: 'Main', line1: 'Durbar Area', city: 'Bhaktapur', state: 'Bagmati', postalCode: '44800', country: 'Nepal', isDefault: true }], createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'C003', name: 'Lalitpur Grocery', email: 'buy@lalitpurgrocery.com', phone: '+977-9851111111', status: 'ACTIVE', orderCount: 34, totalSpent: 445000, addresses: [{ id: 'A003', label: 'Main', line1: 'Patan Dhoka', city: 'Lalitpur', state: 'Bagmati', postalCode: '44700', country: 'Nepal', isDefault: true }], createdAt: new Date(Date.now() - 3888000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'C004', name: 'Chitwan Fresh Direct', email: 'order@chitwanfresh.com', phone: '+977-9871234567', status: 'ACTIVE', orderCount: 18, totalSpent: 215000, addresses: [{ id: 'A004', label: 'Main', line1: 'Bharatpur Main Rd', city: 'Bharatpur', state: 'Chitwan', postalCode: '44200', country: 'Nepal', isDefault: true }], createdAt: new Date(Date.now() - 1296000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'C005', name: 'Pokhara Organics Co.', email: 'deepak@pokharaorganics.com', phone: '+977-9851234567', status: 'ACTIVE', orderCount: 23, totalSpent: 340000, addresses: [{ id: 'A005', label: 'Main', line1: 'Lakeside', city: 'Pokhara', state: 'Gandaki', postalCode: '33700', country: 'Nepal', isDefault: true }], createdAt: new Date(Date.now() - 2592000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'C006', name: 'Nepal Food Supplies', email: 'ops@nepalfood.com', phone: '+977-9842222222', status: 'ACTIVE', orderCount: 56, totalSpent: 780000, addresses: [{ id: 'A006', label: 'Main', line1: 'Tripureshwor', city: 'Kathmandu', state: 'Bagmati', postalCode: '44600', country: 'Nepal', isDefault: true }], createdAt: new Date(Date.now() - 7776000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'C007', name: 'Biratnagar Traders', email: 'kamal@biratnagartraders.com', phone: '+977-9881234567', status: 'SUSPENDED', orderCount: 5, totalSpent: 67000, addresses: [{ id: 'A007', label: 'Main', line1: 'Main Road', city: 'Biratnagar', state: 'Morang', postalCode: '56600', country: 'Nepal', isDefault: true }], createdAt: new Date(Date.now() - 1296000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
];

const MOCK_REVIEWS: Review[] = [
  { id: 'R001', productId: 'P001', productName: 'Basmati Rice', customerId: 'C001', customerName: 'Ram Shrestha', rating: 5, title: 'Great rice', content: 'Excellent quality rice. Perfect for daily cooking.', status: 'APPROVED', isVerifiedPurchase: true, helpfulCount: 3, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'R002', productId: 'P003', productName: 'Turmeric Powder', customerId: 'C002', customerName: 'Sita Devi', rating: 5, title: 'Very aromatic', content: 'Very fresh and aromatic. Great for cooking.', status: 'APPROVED', isVerifiedPurchase: true, helpfulCount: 1, createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'R003', productId: 'P002', productName: 'Mustard Oil', customerId: 'C003', customerName: 'Hari Prasad', rating: 3, title: 'Decent oil', content: 'Good oil but the bottle was slightly damaged on delivery.', status: 'PENDING', isVerifiedPurchase: true, helpfulCount: 0, createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date(Date.now() - 259200000).toISOString() },
  { id: 'R004', productId: 'P004', productName: 'Red Lentils', customerId: 'C004', customerName: 'Gita Maya', rating: 4, title: 'Good quality', content: 'Fresh lentils, cooks quickly. Will buy again.', status: 'APPROVED', isVerifiedPurchase: false, helpfulCount: 2, createdAt: new Date(Date.now() - 345600000).toISOString(), updatedAt: new Date(Date.now() - 345600000).toISOString() },
  { id: 'R005', productId: 'P001', productName: 'Basmati Rice', customerId: 'C005', customerName: 'Bikash Tamang', rating: 1, content: 'This product is TERRIBLE!! Waste of money!!!', status: 'FLAGGED', isVerifiedPurchase: false, helpfulCount: 0, createdAt: new Date(Date.now() - 432000000).toISOString(), updatedAt: new Date(Date.now() - 432000000).toISOString() },
  { id: 'R006', productId: 'P005', productName: 'Cumin Seeds', customerId: 'C006', customerName: 'Anita Karki', rating: 4, title: 'Strong aroma', content: 'Good quality seeds with strong aroma.', status: 'APPROVED', isVerifiedPurchase: true, helpfulCount: 1, createdAt: new Date(Date.now() - 518400000).toISOString(), updatedAt: new Date(Date.now() - 518400000).toISOString() },
];

const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'AUD-001', actorId: 'U001', actorName: 'Super Admin', actorEmail: 'admin@aamako.com', action: 'STATUS_CHANGE', entityType: 'ORDER', entityId: 'ORD-2847', entityLabel: 'ORD-2847', before: { status: 'PENDING' }, after: { status: 'CONFIRMED' }, createdAt: new Date(Date.now() - 600000).toISOString() },
  { id: 'AUD-002', actorId: 'U002', actorName: 'Inventory Manager', actorEmail: 'inventory@aamako.com', action: 'ADJUST', entityType: 'INVENTORY', entityId: 'INV-001', entityLabel: 'Basmati Rice (5kg)', before: { quantity: 130 }, after: { quantity: 150 }, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 'AUD-003', actorId: 'U001', actorName: 'Super Admin', actorEmail: 'admin@aamako.com', action: 'APPROVE', entityType: 'BUSINESS', entityId: 'BIZ-004', entityLabel: 'Chitwan Fresh Direct', before: { status: 'PENDING' }, after: { status: 'APPROVED', priceTier: 'TIER_2' }, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'AUD-004', actorId: 'U003', actorName: 'Content Manager', actorEmail: 'content@aamako.com', action: 'STATUS_CHANGE', entityType: 'REVIEW', entityId: 'R005', entityLabel: 'Review by Bikash Tamang', before: { status: 'FLAGGED' }, after: { status: 'REJECTED' }, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'AUD-005', actorId: 'U002', actorName: 'Inventory Manager', actorEmail: 'inventory@aamako.com', action: 'CREATE', entityType: 'BATCH', entityId: 'BAT-0090', entityLabel: 'BAT-0090', after: { name: 'Basmati Rice Oct 2026', quantity: 500 }, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'AUD-006', actorId: 'U001', actorName: 'Super Admin', actorEmail: 'admin@aamako.com', action: 'STATUS_CHANGE', entityType: 'USER', entityId: 'U004', entityLabel: 'Ram Sales', before: { role: 'SALES' }, after: { role: 'MANAGER' }, createdAt: new Date(Date.now() - 172800000).toISOString() },
];

const MOCK_SALES_REPORT: SalesReport = {
  totalRevenue: 2847500,
  totalOrders: 234,
  averageOrderValue: 12168,
  revenueChange: 15.2,
  ordersChange: 8.7,
  dataPoints: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
    revenue: Math.floor(60000 + (i * 2000) + Math.random() * 20000),
    orders: Math.floor(Math.random() * 12) + 4,
    averageOrderValue: Math.floor(8000 + Math.random() * 6000),
  })),
};

const MOCK_USERS: User[] = [
  { id: 'U001', email: 'admin@aamako.com', name: 'Super Admin', role: 'SUPER_ADMIN', mfaEnabled: true, lastLoginAt: '2026-08-22T10:00:00.000Z', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'U002', email: 'inventory@aamako.com', name: 'Gita Manager', role: 'INVENTORY_MANAGER', mfaEnabled: false, lastLoginAt: '2026-08-21T09:30:00.000Z', createdAt: '2025-03-15T00:00:00.000Z' },
  { id: 'U003', email: 'content@aamako.com', name: 'Hari Editor', role: 'CONTENT_MANAGER', mfaEnabled: false, lastLoginAt: '2026-08-20T14:00:00.000Z', createdAt: '2025-04-01T00:00:00.000Z' },
  { id: 'U004', email: 'sales@aamako.com', name: 'Ram Sales', role: 'SALES', mfaEnabled: false, lastLoginAt: '2026-08-19T11:00:00.000Z', createdAt: '2025-06-01T00:00:00.000Z' },
  { id: 'U005', email: 'support@aamako.com', name: 'Sita Support', role: 'CUSTOMER_SUPPORT', mfaEnabled: false, lastLoginAt: '2026-08-22T08:00:00.000Z', createdAt: '2025-07-01T00:00:00.000Z' },
];

const MOCK_QUOTES: QuoteRequest[] = [
  { id: 'Q001', businessId: 'BIZ-003', businessName: 'Bhaktapur Organics', items: [{ productId: 'P001', productName: 'Basmati Rice (5kg)', quantity: 50 }, { productId: 'P003', productName: 'Turmeric Powder (250g)', quantity: 100 }], status: 'PENDING', createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'Q002', businessId: 'BIZ-001', businessName: 'KTM Fresh Mart', items: [{ productId: 'P002', productName: 'Mustard Oil (1L)', quantity: 200 }], status: 'PENDING', createdAt: new Date(Date.now() - 86400000).toISOString() },
];

// ─── Helper: try API, fall back to mock ──────────────────────────────
async function withFallback<T>(apiCall: () => Promise<T>, mockData: T): Promise<T> {
  try {
    return await apiCall();
  } catch {
    return mockData;
  }
}

// ─── Overview / Dashboard ────────────────────────────────────────────
export function useOverview() {
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: () => withFallback(
      () => apiClient.get<OverviewKPIs>('/admin/overview'),
      MOCK_OVERVIEW,
    ),
  });
}

export function useActivityFeed() {
  return useQuery({
    queryKey: queryKeys.activityFeed,
    queryFn: () => withFallback(
      () => apiClient.get<ActivityFeedItem[]>('/admin/activity-feed'),
      MOCK_ACTIVITIES,
    ),
    refetchInterval: 30_000,
  });
}

export function useFulfillmentPipeline() {
  return useQuery({
    queryKey: queryKeys.pipeline,
    queryFn: () => withFallback(
      () => apiClient.get<FulfillmentPipeline>('/admin/pipeline'),
      MOCK_PIPELINE,
    ),
    refetchInterval: 30_000,
  });
}

// ─── Orders ──────────────────────────────────────────────────────────
export function useOrders(params?: OrderListParams) {
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: () => withFallback(
      () => apiClient.get<PaginatedResponse<Order>>('/admin/orders', { params: params as Record<string, string> }),
      { data: MOCK_ORDERS, total: MOCK_ORDERS.length, page: 1, limit: 20, totalPages: 1 },
    ),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => withFallback(
      () => apiClient.get<Order>(`/admin/orders/${id}`),
      MOCK_ORDERS.find(o => o.id === id) || MOCK_ORDERS[0],
    ),
    enabled: !!id,
  });
}

export function useAdvanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: string; reason?: string }) =>
      apiClient.patch(`/admin/orders/${id}`, { status: to, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      qc.invalidateQueries({ queryKey: queryKeys.pipeline });
    },
  });
}

/** Sales role: update a payment-related order status.
 *  Storefront payment labels are mapped onto the real backend statuses:
 *  PENDING → PAYMENT_PENDING, PAID stays PAID. */
export function useUpdatePaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: PaymentStatus | string }) => {
      const status =
        paymentStatus === 'PENDING'
          ? 'PAYMENT_PENDING'
          : paymentStatus === 'FAILED'
            ? 'PAYMENT_PENDING'
            : paymentStatus;
      return apiClient.patch(`/admin/orders/${id}/payment-status`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      qc.invalidateQueries({ queryKey: queryKeys.pipeline });
    },
  });
}

/** Sales role: process a full refund for a paid/fulfilled/delivered order. */
export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiClient.post(`/admin/orders/${id}/refund`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      qc.invalidateQueries({ queryKey: queryKeys.pipeline });
    },
  });
}

// ─── Products ────────────────────────────────────────────────────────
export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => withFallback(
      () => apiClient.get<PaginatedResponse<Product>>('/admin/products'),
      { data: MOCK_PRODUCTS, total: MOCK_PRODUCTS.length, page: 1, limit: 20, totalPages: 1 },
    ),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => withFallback(
      () => apiClient.get<Product>(`/admin/products/${id}`),
      MOCK_PRODUCTS.find(p => p.id === id) || MOCK_PRODUCTS[0],
    ),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    // Backend DTO shape (name/slug/variants[{sku,name,unit,basePriceCents}])
    mutationFn: (data: unknown) => apiClient.post<any>('/admin/products', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      apiClient.patch<Product>(`/admin/products/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

export function useToggleProductStatus() {
  const qc = useQueryClient();
  return useMutation({
    // Backend expects `isPublished: boolean` on PATCH /admin/products/:id
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/admin/products/${id}`, { isPublished: status === 'ACTIVE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

// ─── Inventory ───────────────────────────────────────────────────────
export function useInventory(params?: InventoryListParams) {
  return useQuery({
    queryKey: queryKeys.inventory(params),
    queryFn: () => withFallback(
      () => apiClient.get<PaginatedResponse<InventoryItem>>('/admin/inventory', { params: params as Record<string, string> }),
      { data: MOCK_INVENTORY, total: MOCK_INVENTORY.length, page: 1, limit: 20, totalPages: 1 },
    ),
  });
}

export function useAdjustInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InventoryAdjustmentRequest) =>
      apiClient.patch('/admin/inventory/adjust', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'inventory'] }),
  });
}

// ─── Batches & Recall ────────────────────────────────────────────────
export function useBatches(params?: BatchListParams) {
  return useQuery({
    queryKey: queryKeys.batches(params),
    queryFn: () => withFallback(
      () => apiClient.get<PaginatedResponse<Batch>>('/admin/batches', { params: params as Record<string, string> }),
      { data: MOCK_BATCHES, total: MOCK_BATCHES.length, page: 1, limit: 20, totalPages: 1 },
    ),
  });
}

export function useBatch(id: string) {
  return useQuery({
    queryKey: queryKeys.batch(id),
    queryFn: () => withFallback(
      () => apiClient.get<Batch>(`/admin/batches/${id}`),
      MOCK_BATCHES.find(b => b.id === id) || MOCK_BATCHES[0],
    ),
    enabled: !!id,
  });
}

export function useRecallImpact(batchId: string) {
  return useQuery({
    queryKey: queryKeys.recallImpact(batchId),
    queryFn: () => withFallback(
      () => apiClient.get<RecallImpact>(`/admin/batches/${batchId}/recall-impact`),
      {
        batchId,
        batchNumber: 'MOCK-BATCH',
        affectedInventoryCount: 15,
        affectedOrderCount: 8,
        affectedCustomerCount: 6,
        affectedCustomers: [
          { id: 'C001', name: 'KTM Fresh Mart', email: 'orders@ktmfresh.com', orderCount: 3, lastOrderDate: new Date(Date.now() - 86400000).toISOString() },
          { id: 'C002', name: 'Bhaktapur Organics', email: 'info@bhaktapurorg.com', orderCount: 2, lastOrderDate: new Date(Date.now() - 172800000).toISOString() },
          { id: 'C003', name: 'Lalitpur Grocery', email: 'buy@lalitpurgrocery.com', orderCount: 3, lastOrderDate: new Date(Date.now() - 259200000).toISOString() },
        ],
        affectedOrders: [
          { id: 'O001', orderNumber: 'ORD-2847', customerName: 'KTM Fresh Mart', quantity: 10, status: 'PENDING', orderedAt: new Date(Date.now() - 300000).toISOString() },
          { id: 'O002', orderNumber: 'ORD-2845', customerName: 'Lalitpur Grocery', quantity: 20, status: 'PROCESSING', orderedAt: new Date(Date.now() - 3600000).toISOString() },
          { id: 'O003', orderNumber: 'ORD-2843', customerName: 'Pokhara Organics Co.', quantity: 30, status: 'SHIPPED', orderedAt: new Date(Date.now() - 14400000).toISOString() },
        ],
        affectedInventory: [
          { warehouseId: 'WH001', warehouseName: 'Main Warehouse - Kathmandu', quantity: 8 },
          { warehouseId: 'WH002', warehouseName: 'Secondary Warehouse - Pokhara', quantity: 7 },
        ],
      },
    ),
    enabled: !!batchId,
  });
}

export function useInitiateRecall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RecallRequest) =>
      apiClient.post('/admin/batches/recall', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'batches'] });
    },
  });
}

// ─── Wholesale / Businesses ──────────────────────────────────────────
export function useBusinesses(params?: BusinessListParams) {
  return useQuery({
    queryKey: queryKeys.businesses(params),
    queryFn: () => withFallback(
      () => apiClient.get<PaginatedResponse<Business>>('/admin/businesses', { params: params as Record<string, string> }),
      { data: MOCK_BUSINESSES, total: MOCK_BUSINESSES.length, page: 1, limit: 20, totalPages: 1 },
    ),
  });
}

export function useBusiness(id: string) {
  return useQuery({
    queryKey: queryKeys.business(id),
    queryFn: () => withFallback(
      () => apiClient.get<Business>(`/admin/businesses/${id}`),
      MOCK_BUSINESSES.find(b => b.id === id) || MOCK_BUSINESSES[0],
    ),
    enabled: !!id,
  });
}

export function useBusinessAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BusinessActionRequest }) =>
      apiClient.patch(`/admin/businesses/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'businesses'] }),
  });
}

export function useQuotes() {
  return useQuery({
    queryKey: queryKeys.quotes,
    queryFn: () => withFallback(
      () => apiClient.get<QuoteRequest[]>('/admin/quotes'),
      MOCK_QUOTES,
    ),
  });
}

export function useRespondToQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note, estimatedTotal }: { id: string; note: string; estimatedTotal?: number }) =>
      apiClient.patch(`/admin/quotes/${id}`, { responseNote: note, totalEstimate: estimatedTotal }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.quotes }),
  });
}

// ─── Customers ───────────────────────────────────────────────────────
export function useCustomers(params?: CustomerListParams) {
  return useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: () => withFallback(
      () => apiClient.get<PaginatedResponse<Customer>>('/admin/customers', { params: params as Record<string, string> }),
      { data: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length, page: 1, limit: 20, totalPages: 1 },
    ),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => withFallback(
      () => apiClient.get<Customer>(`/admin/customers/${id}`),
      MOCK_CUSTOMERS.find(c => c.id === id) || MOCK_CUSTOMERS[0],
    ),
    enabled: !!id,
  });
}

export function useSuspendCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/admin/customers/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'customers'] }),
  });
}

// ─── Reviews ─────────────────────────────────────────────────────────
export function useReviews(params?: ReviewListParams) {
  return useQuery({
    queryKey: queryKeys.reviews(params),
    queryFn: () => withFallback(
      () => apiClient.get<PaginatedResponse<Review>>('/admin/reviews', { params: params as Record<string, string> }),
      { data: MOCK_REVIEWS, total: MOCK_REVIEWS.length, page: 1, limit: 20, totalPages: 1 },
    ),
  });
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewModerationRequest }) =>
      apiClient.patch(`/admin/reviews/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });
}

// ─── Audit Log ───────────────────────────────────────────────────────
export function useAuditLogs(params?: AuditLogListParams) {
  return useQuery({
    queryKey: queryKeys.auditLogs(params),
    queryFn: () => withFallback(
      () => apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params: params as Record<string, string> }),
      { data: MOCK_AUDIT_LOGS, total: MOCK_AUDIT_LOGS.length, page: 1, limit: 20, totalPages: 1 },
    ),
  });
}

// ─── Analytics ───────────────────────────────────────────────────────
export function useSalesReport(params: SalesReportParams) {
  return useQuery({
    queryKey: queryKeys.salesReport(params),
    queryFn: () => withFallback(
      () => apiClient.get<SalesReport>('/admin/reports/sales', { params: { range: params.range, ...(params.dateFrom && { dateFrom: params.dateFrom }), ...(params.dateTo && { dateTo: params.dateTo }) } as Record<string, string> }),
      MOCK_SALES_REPORT,
    ),
  });
}

// ─── Settings / Users ────────────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => withFallback(
      async () => {
        const res = await apiClient.get<any[]>('/admin/users');
        // Backend returns firstName/lastName; map to the dashboard User shape.
        return res.map((u) => ({
          id: u.id,
          email: u.email,
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
          role: u.role as Role,
          mfaEnabled: !!u.totpEnabled,
          lastLoginAt: u.createdAt,
          createdAt: u.createdAt,
        }));
      },
      MOCK_USERS,
    ),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiClient.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

/** Permanently remove a dashboard user (admin / super admin only). */
export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export interface CreateStaffInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  role: Role;
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStaffInput) =>
      apiClient.post<any>('/admin/users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

// ─── Notifications ──────────────────────────────────────────────────
export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  read: boolean;
  createdAt: string;
}

const MOCK_APP_NOTIFICATIONS: AdminNotification[] = [
  { id: 'N001', type: 'ORDER', title: 'New order received', message: 'Order #ORD-2847 from KTM Fresh Mart — Rs. 12,400', read: false, createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: 'N002', type: 'INVENTORY', title: 'Low stock alert', message: 'Red Lentils (1kg) has only 15 units remaining', read: false, createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: 'N003', type: 'SUPPORT', title: 'New support ticket', message: 'Urgent: Account access issue from Pokhara Organics', read: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 'N004', type: 'SYSTEM', title: 'System maintenance scheduled', message: 'Scheduled maintenance window: Aug 25, 2026 2:00 AM - 4:00 AM', read: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'N005', type: 'ORDER', title: 'Order shipped', message: 'Order #ORD-2843 shipped via Pathao Courier', read: true, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'N006', type: 'USER', title: 'New user registered', message: 'Ram Sales (sales@aamako.com) joined the team', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
];

// Read-state for demo notifications (ids not backed by the database), so a
// "mark as read" survives the 15s background refetch.
const notificationReadIds = new Set<string>();

function withReadState(list: AdminNotification[]): AdminNotification[] {
  return list.map((n) => (notificationReadIds.has(n.id) ? { ...n, read: true } : n));
}

export function useNotifications() {
  return useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () =>
      withFallback<AdminNotification[]>(
        async () => {
          const res = await apiClient.get<any[]>('/notifications');
          // Empty inbox (nothing seeded for this user yet) → show the shared
          // demo set so the section and the header bell stay in sync.
          if (!Array.isArray(res) || res.length === 0) {
            return withReadState(MOCK_APP_NOTIFICATIONS);
          }
          // Backend shape: { id, userId, type, title, message, actionUrl, isRead, createdAt }
          return res.map((n) => ({
            id: n.id,
            type: n.type ?? 'SYSTEM',
            title: n.title,
            message: n.message,
            actionUrl: n.actionUrl ?? undefined,
            read: !!n.isRead,
            createdAt: n.createdAt,
          }));
        },
        MOCK_APP_NOTIFICATIONS,
      ),
    refetchInterval: 15000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: (_res, id) => {
      // Optimistically update the cache; remember demo ids so the 15s
      // refetch (which falls back to the demo set) keeps them read.
      notificationReadIds.add(id);
      qc.setQueryData<AdminNotification[]>(['admin', 'notifications'], (old) =>
        old ? old.map((n) => (n.id === id ? { ...n, read: true } : n)) : old
      );
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => {
      qc.setQueryData<AdminNotification[]>(['admin', 'notifications'], (old) => {
        old?.forEach((n) => notificationReadIds.add(n.id));
        return old ? old.map((n) => ({ ...n, read: true })) : old;
      });
    },
  });
}

// ─── Notifications ──────────────────────────────────────────────────
