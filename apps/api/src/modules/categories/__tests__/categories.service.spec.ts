import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../categories.service';
import { CategoriesRepository, CategoryWithChildren } from '../categories.repository';
import {
  NotFoundDomainException,
  ConflictDomainException,
  SystemCategoryException,
  DomainException,
} from '../../../common/exceptions/domain.exception';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByNameAndParent: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    reorder: jest.Mock;
  };

  const mockCategory: CategoryWithChildren = {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Oziq-ovqat',
    type: 'EXPENSE',
    icon: '🍔',
    color: '#ef4444',
    parentId: null,
    isSystem: false,
    sortOrder: 0,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    deletedAt: null,
    children: [],
  };

  beforeEach(async () => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNameAndParent: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoriesRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('returns categories tree with children', async () => {
      const child: CategoryWithChildren = {
        id: 'cat-child',
        userId: 'user-1',
        name: 'Supermarket',
        type: 'EXPENSE',
        icon: '🛒',
        color: '#ef4444',
        parentId: 'cat-1',
        isSystem: false,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      repository.findAll.mockResolvedValue([{ ...mockCategory, children: [child] }]);

      const res = await service.list('user-1');

      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('Oziq-ovqat');
      expect(res[0].children).toHaveLength(1);
      expect(res[0].children?.[0].name).toBe('Supermarket');
    });
  });

  describe('getById', () => {
    it('returns category by ID', async () => {
      repository.findById.mockResolvedValue(mockCategory);

      const res = await service.getById('user-1', 'cat-1');
      expect(res.id).toBe('cat-1');
    });

    it('throws NotFoundDomainException (404) if not found or not owner', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('user-1', 'unknown')).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('create', () => {
    it('creates a category', async () => {
      repository.findByNameAndParent.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockCategory);

      const res = await service.create('user-1', {
        name: 'Oziq-ovqat',
        type: 'EXPENSE',
        icon: '🍔',
        color: '#ef4444',
      });

      expect(res.name).toBe('Oziq-ovqat');
    });

    it('throws ConflictDomainException (409) on duplicate name under same parent', async () => {
      repository.findByNameAndParent.mockResolvedValue(mockCategory);

      await expect(
        service.create('user-1', {
          name: 'Oziq-ovqat',
          type: 'EXPENSE',
          icon: '🍔',
          color: '#ef4444',
        }),
      ).rejects.toThrow(ConflictDomainException);
    });

    it('throws DomainException (422) if parent is already a child (max 2 levels)', async () => {
      repository.findById.mockResolvedValue({
        ...mockCategory,
        id: 'cat-parent-child',
        parentId: 'root-id', // already a child
      });

      await expect(
        service.create('user-1', {
          name: 'Chuqur kategoriya',
          type: 'EXPENSE',
          icon: '🍔',
          color: '#ef4444',
          parentId: 'cat-parent-child',
        }),
      ).rejects.toThrow(DomainException);
    });

    it('throws DomainException (422) if parent type does not match child type', async () => {
      repository.findById.mockResolvedValue({
        ...mockCategory,
        type: 'INCOME',
      });

      await expect(
        service.create('user-1', {
          name: 'Xarajat bola',
          type: 'EXPENSE',
          icon: '🍔',
          color: '#ef4444',
          parentId: 'cat-1',
        }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('delete', () => {
    it('throws SystemCategoryException (422 SYSTEM_CATEGORY) when attempting to delete system category', async () => {
      repository.findById.mockResolvedValue({
        ...mockCategory,
        isSystem: true,
      });

      await expect(service.delete('user-1', 'cat-1')).rejects.toThrow(SystemCategoryException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes non-system category and passes child IDs for transaction categoryId nullification', async () => {
      repository.findById.mockResolvedValue({
        ...mockCategory,
        children: [{ id: 'child-1' }],
      });

      await service.delete('user-1', 'cat-1');

      expect(repository.delete).toHaveBeenCalledWith('user-1', 'cat-1', ['child-1']);
    });
  });
});
