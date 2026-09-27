import { Injectable, Logger } from '@nestjs/common';
import { NewNotification, NotificationsRepository } from './notifications.repository';
import { ListNotificationsQueryDto } from './dto/notification.dto';
import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { Notification, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly repository: NotificationsRepository) {}

  async list(userId: string, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total, unreadCount] = await this.repository.findMany(userId, {
      skip,
      take: limit,
      unreadOnly: query.unreadOnly,
    });

    return {
      data: items.map(this.mapToResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
      },
    };
  }

  async markAsRead(userId: string, id: string) {
    const updated = await this.repository.markAsRead(userId, id);
    if (!updated) {
      throw new NotFoundDomainException('Bildirishnoma topilmadi');
    }
    return this.mapToResponse(updated);
  }

  async markAllAsRead(userId: string) {
    const count = await this.repository.markAllAsRead(userId);
    return { updatedCount: count };
  }

  async delete(userId: string, id: string) {
    const deleted = await this.repository.delete(userId, id);
    if (!deleted) {
      throw new NotFoundDomainException('Bildirishnoma topilmadi');
    }
  }

  /**
   * Internal helper for other modules to safely create notifications.
   * Will never throw to prevent blocking the main business operation.
   */
  async createSafe(userId: string, data: NewNotification): Promise<Notification | null> {
    try {
      return await this.repository.create(userId, data);
    } catch (err) {
      // A duplicate dedupeKey means this alert was already delivered: that is success.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return null;
      }
      this.logger.error(`Failed to create notification for user ${userId}`, err);
      return null;
    }
  }

  private mapToResponse(n: Notification) {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      meta: n.meta as Record<string, unknown> | null,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
