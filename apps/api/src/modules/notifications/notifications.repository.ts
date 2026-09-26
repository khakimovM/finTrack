import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Notification, NotificationType, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    userId: string,
    params: {
      skip?: number;
      take?: number;
      unreadOnly?: boolean;
    },
  ): Promise<[Notification[], number, number]> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return [items, total, unreadCount];
  }

  async findById(userId: string, id: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({
      where: { id, userId },
    });
  }

  async create(
    userId: string,
    data: {
      type: NotificationType;
      title: string;
      body: string;
      meta?: Prisma.InputJsonValue;
    },
  ): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        meta: data.meta,
      },
    });
  }

  async markAsRead(userId: string, id: string): Promise<Notification | null> {
    const existing = await this.findById(userId, id);
    if (!existing) return null;

    return this.prisma.notification.update({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.findById(userId, id);
    if (!existing) return false;

    await this.prisma.notification.delete({
      where: { id, userId },
    });
    return true;
  }
}
