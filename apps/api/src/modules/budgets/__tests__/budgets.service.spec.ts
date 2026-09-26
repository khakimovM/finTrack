import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from '../budgets.service';
import { BudgetsRepository, BudgetWithCategory } from '../budgets.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { CategoriesRepository } from '../../categories/categories.repository';
import { ConflictDomainException } from '../../../common/exceptions/domain.exception';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let repository: {
    findByCategoryAndMonth: jest.Mock;
    findManyByMonth: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    updateNotifiedAt: jest.Mock;
    getCategorySpent: jest.Mock;
  };
  let notificationsService: {
    createSafe: jest.Mock;
  };
  let categoriesRepository: {
    findById: jest.Mock;
  };

  const mockCategory = {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Oziq-ovqat',
    type: 'EXPENSE' as const,
    icon: '🍔',
    color: '#ef4444',
    parentId: null,
    sortOrder: 1,
    isSystem: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBudget: BudgetWithCategory = {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    month: new Date(Date.UTC(2026, 7, 1)), // 2026-08-01
    limitAmount: 10000000n, // 100 000 so'm
    notifiedAt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: mockCategory,
  };

  beforeEach(async () => {
    repository = {
      findByCategoryAndMonth: jest.fn(),
      findManyByMonth: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateNotifiedAt: jest.fn(),
      getCategorySpent: jest.fn(),
    };

    notificationsService = {
      createSafe: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    categoriesRepository = {
      findById: jest.fn().mockResolvedValue(mockCategory),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: BudgetsRepository, useValue: repository },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: CategoriesRepository, useValue: categoriesRepository },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatus', () => {
    it('returns budget status with spent, remaining, and OK state (<80%)', async () => {
      repository.findManyByMonth.mockResolvedValue([mockBudget]);
      repository.getCategorySpent.mockResolvedValue(5000000n); // 50%

      const res = await service.getStatus('user-1', '2026-08');

      expect(res.data).toHaveLength(1);
      expect(res.data[0].spent).toBe('5000000');
      expect(res.data[0].percent).toBe(50);
      expect(res.data[0].state).toBe('OK');
      expect(res.data[0].remaining).toBe('5000000');
    });

    it('returns WARNING state when spent is 80-100%', async () => {
      repository.findManyByMonth.mockResolvedValue([mockBudget]);
      repository.getCategorySpent.mockResolvedValue(8500000n); // 85%

      const res = await service.getStatus('user-1', '2026-08');

      expect(res.data[0].state).toBe('WARNING');
      expect(res.data[0].percent).toBe(85);
    });

    it('returns EXCEEDED state when spent is >100%', async () => {
      repository.findManyByMonth.mockResolvedValue([mockBudget]);
      repository.getCategorySpent.mockResolvedValue(12000000n); // 120%

      const res = await service.getStatus('user-1', '2026-08');

      expect(res.data[0].state).toBe('EXCEEDED');
      expect(res.data[0].percent).toBe(120);
      expect(res.data[0].remaining).toBe('0');
    });
  });

  describe('create', () => {
    it('creates budget successfully', async () => {
      repository.findByCategoryAndMonth.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockBudget);

      const res = await service.create('user-1', {
        categoryId: 'cat-1',
        month: '2026-08',
        limitAmount: '10000000',
      });

      expect(res.id).toBe('budget-1');
      expect(res.limitAmount).toBe('10000000');
    });

    it('throws ConflictDomainException (409) if budget exists for the month', async () => {
      repository.findByCategoryAndMonth.mockResolvedValue(mockBudget);

      await expect(
        service.create('user-1', {
          categoryId: 'cat-1',
          month: '2026-08',
          limitAmount: '10000000',
        }),
      ).rejects.toThrow(ConflictDomainException);
    });
  });

  describe('checkAndNotify', () => {
    it('sends BUDGET_WARNING notification at 80% threshold once and updates notifiedAt', async () => {
      repository.findByCategoryAndMonth.mockResolvedValue({
        ...mockBudget,
        notifiedAt: 0,
      });
      repository.getCategorySpent.mockResolvedValue(8500000n); // 85%

      const alert = await service.checkAndNotify('user-1', 'cat-1', new Date('2026-08-15'));

      expect(alert).not.toBeNull();
      expect(alert?.percent).toBe(85);
      expect(notificationsService.createSafe).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'BUDGET_WARNING' }),
      );
      expect(repository.updateNotifiedAt).toHaveBeenCalledWith('budget-1', 80);
    });

    it('does NOT send BUDGET_WARNING again if already notified at 80', async () => {
      repository.findByCategoryAndMonth.mockResolvedValue({
        ...mockBudget,
        notifiedAt: 80,
      });
      repository.getCategorySpent.mockResolvedValue(9000000n); // 90%

      const alert = await service.checkAndNotify('user-1', 'cat-1', new Date('2026-08-15'));

      expect(alert).not.toBeNull();
      expect(notificationsService.createSafe).not.toHaveBeenCalled();
      expect(repository.updateNotifiedAt).not.toHaveBeenCalled();
    });

    it('sends BUDGET_EXCEEDED notification at 100% threshold', async () => {
      repository.findByCategoryAndMonth.mockResolvedValue({
        ...mockBudget,
        notifiedAt: 80,
      });
      repository.getCategorySpent.mockResolvedValue(10500000n); // 105%

      const alert = await service.checkAndNotify('user-1', 'cat-1', new Date('2026-08-15'));

      expect(alert).not.toBeNull();
      expect(notificationsService.createSafe).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'BUDGET_EXCEEDED' }),
      );
      expect(repository.updateNotifiedAt).toHaveBeenCalledWith('budget-1', 100);
    });

    it('never throws even if database error occurs, fulfilling "budget never blocks transaction"', async () => {
      repository.findByCategoryAndMonth.mockRejectedValue(new Error('DB crashed'));

      const alert = await service.checkAndNotify('user-1', 'cat-1', new Date('2026-08-15'));

      expect(alert).toBeNull(); // Graceful fallback
    });
  });
});
