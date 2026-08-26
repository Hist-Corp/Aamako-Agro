import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateProductDto,
  CreateVariantDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

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

  async create(dto: CreateProductDto) {
    const { variants, ...product } = dto;
    const created = await this.prisma.product.create({
      data: {
        ...product,
        variants: variants
          ? {
              create: variants.map((v) => ({
                ...v,
                inventory: { create: {} },
              })),
            }
          : undefined,
      },
      include: { variants: { include: { inventory: true } } },
    });

    // Notify content managers so they can add the product to the website.
    await this.notifications.notifyRole('CONTENT_MANAGER', {
      type: 'PRODUCT',
      title: 'New product added to inventory',
      message: `"${created.name}" was added to the inventory and is waiting to be published to the website.`,
      actionUrl: '/products',
    }).catch(() => undefined);

    return created;
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

  async addVariant(productId: string, dto: CreateVariantDto) {
    const product = await this.ensure(productId);
    const variant = await this.prisma.productVariant.create({
      data: {
        ...dto,
        productId,
        inventory: { create: {} },
      },
    });
    await this.notifications.notifyRole('CONTENT_MANAGER', {
      type: 'PRODUCT',
      title: 'New variant added to inventory',
      message: `"${variant.name}" (${dto.sku}) was added to "${product.name}". Review and publish it to the website.`,
      actionUrl: '/products',
    }).catch(() => undefined);
    return variant;
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
    return p;
  }
}
