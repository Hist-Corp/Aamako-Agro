import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { CacheNamespaces, CacheTtls } from '../common/cache.namespaces';

export type MediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export interface MediaPayload {
  name?: string;
  url?: string;
  altText?: string;
  category?: string;
  size?: string;
  dimensions?: string;
  sourcePage?: string;
  sourceSection?: string;
}

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /** Invalidate the public media feed after any asset change. */
  private invalidatePublicFeed(): void {
    this.cache.bump(CacheNamespaces.MEDIA);
  }

  list(filters?: { category?: string; type?: string; isPublished?: boolean }) {
    const where: Record<string, unknown> = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.type) where.type = filters.type;
    if (filters?.isPublished !== undefined) where.isPublished = filters.isPublished;
    return this.prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media not found');
    return asset;
  }

  async create(data: Required<Pick<MediaPayload, 'name' | 'url'>> & MediaPayload, actorId?: string) {
    const url = data.url.trim();
    // One library entry per file: if this URL is already registered, fold the
    // new metadata into the existing asset instead of inserting a duplicate
    // row. Duplicates made the same image appear under two page sections at
    // once (e.g. filed under "Home" AND a stray copy under "General").
    const existing = await this.prisma.mediaAsset.findFirst({ where: { url } });
    if (existing) {
      const merged = await this.prisma.mediaAsset.update({
        where: { id: existing.id },
        data: {
          ...(data.name?.trim() ? { name: data.name.trim() } : {}),
          ...(data.altText !== undefined ? { altText: data.altText?.trim() || null } : {}),
          ...(data.category?.trim() ? { category: data.category.trim() } : {}),
          ...(data.size ? { size: data.size } : {}),
          ...(data.dimensions ? { dimensions: data.dimensions } : {}),
          ...(data.sourcePage !== undefined ? { sourcePage: data.sourcePage?.trim() || null } : {}),
          ...(data.sourceSection !== undefined ? { sourceSection: data.sourceSection?.trim() || null } : {}),
        },
      });
      this.invalidatePublicFeed();
      return merged;
    }
    const asset = await this.prisma.mediaAsset.create({
      data: {
        name: data.name.trim(),
        type: 'IMAGE',
        url,
        altText: data.altText?.trim() || null,
        category: data.category?.trim() || 'General',
        size: data.size || null,
        dimensions: data.dimensions || null,
        sourcePage: data.sourcePage?.trim() || null,
        sourceSection: data.sourceSection?.trim() || null,
        isPublished: true,
        uploadedById: actorId,
      },
    });
    this.invalidatePublicFeed();
    return asset;
  }

  async update(id: string, dto: MediaPayload) {
    const asset = await this.get(id);
    const updated = await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.url !== undefined ? { url: dto.url.trim() } : {}),
        ...(dto.altText !== undefined ? { altText: dto.altText?.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || 'General' } : {}),
        ...(dto.size !== undefined ? { size: dto.size || null } : {}),
        ...(dto.dimensions !== undefined ? { dimensions: dto.dimensions || null } : {}),
      },
    });
    this.invalidatePublicFeed();
    return updated;
  }

  async setPublished(id: string, isPublished: boolean) {
    await this.get(id);
    const updated = await this.prisma.mediaAsset.update({ where: { id }, data: { isPublished } });
    this.invalidatePublicFeed();
    return updated;
  }

  async remove(id: string) {
    await this.get(id);
    const deleted = await this.prisma.mediaAsset.delete({ where: { id } });
    this.invalidatePublicFeed();
    return deleted;
  }

  listCategories() {
    return this.prisma.mediaAsset.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    }).then((rows) => rows.map((r) => r.category));
  }

  /**
   * PUBLIC (storefront) listing — published images only, minimal fields.
   * The storefront content hydrator pulls this feed so images uploaded to the
   * library (categorized by page: Home, Shop, Product Category, …) can be
   * shown on the live site without exposing provenance, uploader or
   * unpublished assets.
   */
  listPublic() {
    return this.cache.getOrSet(CacheNamespaces.MEDIA, 'all', CacheTtls.MEDIA_SECONDS, () =>
      this.prisma.mediaAsset.findMany({
        where: { isPublished: true, type: 'IMAGE' },
        select: {
          id: true,
          name: true,
          type: true,
          url: true,
          altText: true,
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
}