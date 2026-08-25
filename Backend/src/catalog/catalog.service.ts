import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  CreateVariantDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async list(q: ListProductsQueryDto) {
    const where = {
      isPublished: true,
      ...(q.categorySlug
        ? { category: { slug: q.categorySlug } }
        : {}),
      ...(q.search
        ? { name: { contains: q.search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: { where: { isActive: true }, include: { inventory: true } },
        },
        skip: ((q.page ?? 1) - 1) * (q.limit ?? 20),
        take: q.limit ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: q.page ?? 1, limit: q.limit ?? 20 };
  }

  async getByIdOrSlug(idOrSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isPublished: true,
      },
      include: {
        category: true,
        variants: { where: { isActive: true }, include: { inventory: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  create(dto: CreateProductDto) {
    const { variants, ...product } = dto;
    return this.prisma.product.create({
      data: {
        ...product,
        variants: variants
          ? { create: variants.map((v) => ({ ...v })) }
          : undefined,
      },
      include: { variants: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.ensure(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    // Soft-delete via unpublish to preserve order history integrity.
    return this.prisma.product.update({
      where: { id },
      data: { isPublished: false },
    });
  }

  addVariant(productId: string, dto: CreateVariantDto) {
    return this.prisma.productVariant.create({
      data: {
        ...dto,
        productId,
        inventory: { create: {} },
      },
    });
  }

  listCategories() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  private async ensure(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
  }
}
