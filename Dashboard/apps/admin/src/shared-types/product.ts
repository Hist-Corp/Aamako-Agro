// ─── Product Types ────────────────────────────────────────────────────

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  wholesalePrice?: number;
  weight?: number;
  isActive: boolean;
  attributes: Record<string, string>;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  status: ProductStatus;
  categoryId: string;
  categoryName: string;
  images: ProductImage[];
  variants: ProductVariant[];
  basePrice: number;
  wholesalePriceTier1?: number;
  wholesalePriceTier2?: number;
  wholesalePriceTier3?: number;
  unit: string;
  origin: string;
  tags: string[];
  sku?: string;
  totalStock: number;
  lowStockThreshold: number;
  isFeatured: boolean;
  nutritionInfo?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  productCount: number;
}
