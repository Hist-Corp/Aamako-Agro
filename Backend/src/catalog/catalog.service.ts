import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  ListProductsQueryDto,
  UpdateCategoryDto,
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
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');
    }
    const { variants, ...product } = dto;
    const created = await this.prisma.product.create({
      data: {
        ...product,
        variants: {
          create: variants.map((v) => ({
            ...v,
            inventory: { create: {} },
          })),
        },
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

  /** Rename a category — the display name only; the slug (and therefore all
   *  existing collection.html?cat=… links) stays stable. */
  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  /** Create a new product category page. The template (collection.html) is
   *  shared — only the name/slug differ, so the new page immediately works:
   *  it appears in the storefront category chips/sidebar and products can be
   *  assigned to it from Dashboard → Products. */
  async createCategory(dto: CreateCategoryDto) {
    const slug =
      dto.slug ??
      dto.name
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!slug) throw new ConflictException('Could not derive a URL slug from that name — provide a slug.');
    try {
      return await this.prisma.category.create({
        data: { name: dto.name.trim(), slug },
      });
    } catch {
      // P2002 — unique constraint on name or slug
      throw new ConflictException(
        `A category with that ${dto.slug ? 'slug' : 'name or slug'} already exists.`,
      );
    }
  }

  /** Admin listing — everything the dashboard Products screen needs,
   *  including publish state, category, variants and stock levels. */
  adminList() {
    return this.prisma.product.findMany({
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          include: { inventory: { select: { stockOnHand: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensure(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }
}
