import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { NotificationsRepository } from '../notifications.repository';
import { NotFoundDomainException } from '../../../common/exceptions/domain.exception';
import { Notification, NotificationType } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: jest.Mocked<NotificationsRepository>;

  const mockUserId = 'user-123';
  const mockNotification: Notification = {
    id: 'notif-1',
    userId: mockUserId,
    type: NotificationType.BUDGET_WARNING,
    title: 'Byudjet ogohlantirishi',
    body: 'Oziq-ovqat byudjeti 80% ga yetdi',
    meta: { categoryId: 'cat-1', percent: 85 },
    dedupeKey: null,
    telegramSentAt: null,
    readAt: null,
    createdAt: new Date('2026-09-01T12:00:00Z'),
  };

  beforeEach(async () => {
    const mockRepo = {
      findMany: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = module.get(NotificationsRepository);
  });

  describe('list', () => {
    it('returns paginated list of notifications with metadata', async () => {
      repository.findMany.mockResolvedValue([[mockNotification], 1, 1]);

      const result = await service.list(mockUserId, { page: 1, limit: 10 });

      expect(repository.findMany).toHaveBeenCalledWith(mockUserId, {
        skip: 0,
        take: 10,
        unreadOnly: undefined,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockNotification.id);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        unreadCount: 1,
      });
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read and returns mapped response', async () => {
      const readDate = new Date();
      repository.markAsRead.mockResolvedValue({
        ...mockNotification,
        readAt: readDate,
      });

      const result = await service.markAsRead(mockUserId, 'notif-1');

      expect(repository.markAsRead).toHaveBeenCalledWith(mockUserId, 'notif-1');
      expect(result.readAt).toBe(readDate.toISOString());
    });

    it('throws NotFoundDomainException if notification not found', async () => {
      repository.markAsRead.mockResolvedValue(null);

      await expect(service.markAsRead(mockUserId, 'notif-404')).rejects.toThrow(
        NotFoundDomainException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read and returns updated count', async () => {
      repository.markAllAsRead.mockResolvedValue(5);

      const result = await service.markAllAsRead(mockUserId);

      expect(repository.markAllAsRead).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({ updatedCount: 5 });
    });
  });

  describe('delete', () => {
    it('deletes notification successfully', async () => {
      repository.delete.mockResolvedValue(true);

      await service.delete(mockUserId, 'notif-1');

      expect(repository.delete).toHaveBeenCalledWith(mockUserId, 'notif-1');
    });

    it('throws NotFoundDomainException if notification to delete does not exist', async () => {
      repository.delete.mockResolvedValue(false);

      await expect(service.delete(mockUserId, 'notif-404')).rejects.toThrow(
        NotFoundDomainException,
      );
    });
  });

  describe('createSafe', () => {
    it('creates notification without throwing', async () => {
      repository.create.mockResolvedValue(mockNotification);

      const result = await service.createSafe(mockUserId, {
        type: NotificationType.BUDGET_WARNING,
        title: 'Title',
        body: 'Body',
      });

      expect(result).toEqual(mockNotification);
    });

    it('catches repository errors and returns null safely', async () => {
      repository.create.mockRejectedValue(new Error('Database unavailable'));

      const result = await service.createSafe(mockUserId, {
        type: NotificationType.BUDGET_WARNING,
        title: 'Title',
        body: 'Body',
      });

      expect(result).toBeNull();
    });
  });
});

describe('NotificationsService.createSafe idempotency', () => {
  it('treats a duplicate dedupeKey as already delivered (returns null, never throws)', async () => {
    const { Prisma } = await import('@prisma/client');
    const repo = {
      create: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.22.0' }),
      ),
    };
    const service = new NotificationsService(repo as unknown as NotificationsRepository);
    await expect(
      service.createSafe('u1', { type: 'DEBT_OVERDUE', title: 't', body: 'b', dedupeKey: 'k' }),
    ).resolves.toBeNull();
  });
});
