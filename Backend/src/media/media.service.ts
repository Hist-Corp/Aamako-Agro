import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export interface MediaPayload {
  name?: string;
  url?: string;
  altText?: string;
  category?: string;
  size?: string;
  dimensions?: string;
}

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.mediaAsset.create({
      data: {
        name: data.name.trim(),
        type: 'IMAGE',
        url: data.url.trim(),
        altText: data.altText?.trim() || null,
        category: data.category?.trim() || 'General',
        size: data.size || null,
        dimensions: data.dimensions || null,
        isPublished: true,
        uploadedById: actorId,
      },
    });
  }

  async update(id: string, dto: MediaPayload) {
    const asset = await this.get(id);
    return this.prisma.mediaAsset.update({
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
  }

  async setPublished(id: string, isPublished: boolean) {
    await this.get(id);
    return this.prisma.mediaAsset.update({ where: { id }, data: { isPublished } });
  }

  async remove(id: string) {
    await this.get(id);
    return this.prisma.mediaAsset.delete({ where: { id } });
  }

  listCategories() {
    return this.prisma.mediaAsset.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    }).then((rows) => rows.map((r) => r.category));
  }
}