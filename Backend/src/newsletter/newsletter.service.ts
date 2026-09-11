import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Injectable()
export class NewsletterService {
  constructor(private prisma: PrismaService) {}

  // Prisma client types regenerate on `prisma generate`; the Subscriber model
  // exists in schema.prisma but generated types may lag in a working tree, so
  // go through a loosely-typed handle instead of blocking the build.
  private get subscribers(): any {
    return (this.prisma as any).subscriber;
  }

  async subscribe(dto: SubscribeDto): Promise<{ success: boolean; message: string }> {
    const source = dto.source ?? 'homepage';
    const existing = await this.subscribers.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing && existing.isActive) {
      return { success: true, message: 'You\'re already subscribed. Thank you!' };
    }

    if (existing && !existing.isActive) {
      await this.subscribers.update({
        where: { id: existing.id },
        data: { isActive: true, source },
      });
      return { success: true, message: 'Welcome back! You\'ve been re-subscribed.' };
    }

    await this.subscribers.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        source,
        isActive: true,
      },
    });

    return { success: true, message: 'Thank you! You\'re now subscribed. Watch your inbox for recipes.' };
  }

  async unsubscribe(email: string): Promise<{ success: boolean; message: string }> {
    const subscriber = await this.subscribers.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!subscriber) {
      return { success: false, message: 'This email is not subscribed.' };
    }

    await this.subscribers.update({
      where: { id: subscriber.id },
      data: { isActive: false },
    });

    return { success: true, message: 'You\'ve been unsubscribed. We\'ll miss you.' };
  }

  async list(page = 1, limit = 50): Promise<{ subscribers: any[]; total: number; page: number }> {
    const skip = (page - 1) * limit;
    const [subscribers, total] = await Promise.all([
      this.prisma.subscriber.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          source: true,
          createdAt: true,
        },
      }),
      this.prisma.subscriber.count({ where: { isActive: true } }),
    ]);

    return { subscribers, total, page };
  }
}