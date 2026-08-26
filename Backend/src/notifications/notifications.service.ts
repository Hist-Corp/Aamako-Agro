import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** All notifications for a staff user, newest first. */
  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true, updated: res.count };
  }

  /** Fan-out a notification to every active user with the given role. */
  async notifyRole(
    role: string,
    payload: { type: string; title: string; message: string; actionUrl?: string },
  ) {
    const users = await this.prisma.user.findMany({
      where: { role: role as never, isActive: true },
      select: { id: true },
    });
    if (users.length === 0) return { count: 0 };
    return this.prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, ...payload })),
    });
  }
}
