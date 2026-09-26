import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from '../tags.service';
import { TagsRepository, TagWithCount } from '../tags.repository';
import {
  NotFoundDomainException,
  ConflictDomainException,
} from '../../../common/exceptions/domain.exception';

describe('TagsService', () => {
  let service: TagsService;
  let repository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByName: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const mockTag: TagWithCount = {
    id: 'tag-1',
    userId: 'user-1',
    name: 'oila',
    color: '#94a3b8',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    _count: { transactions: 3 },
  };

  beforeEach(async () => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: TagsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('returns all tags for user with transaction count', async () => {
      repository.findAll.mockResolvedValue([mockTag]);

      const res = await service.list('user-1');

      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('oila');
      expect(res[0].transactionCount).toBe(3);
    });
  });

  describe('getById', () => {
    it('returns tag by ID', async () => {
      repository.findById.mockResolvedValue(mockTag);

      const res = await service.getById('user-1', 'tag-1');
      expect(res.id).toBe('tag-1');
    });

    it('throws NotFoundDomainException (404) if not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('user-1', 'unknown')).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('create', () => {
    it('creates a tag', async () => {
      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockTag);

      const res = await service.create('user-1', {
        name: 'oila',
        color: '#94a3b8',
      });

      expect(res.name).toBe('oila');
    });

    it('throws ConflictDomainException (409) if duplicate name', async () => {
      repository.findByName.mockResolvedValue(mockTag);

      await expect(
        service.create('user-1', {
          name: 'oila',
          color: '#94a3b8',
        }),
      ).rejects.toThrow(ConflictDomainException);
    });
  });

  describe('update', () => {
    it('updates tag', async () => {
      repository.findById.mockResolvedValue(mockTag);
      repository.update.mockResolvedValue({
        ...mockTag,
        name: 'oilaviy',
      });

      const res = await service.update('user-1', 'tag-1', {
        name: 'oilaviy',
      });

      expect(res.name).toBe('oilaviy');
    });
  });

  describe('delete', () => {
    it('deletes tag', async () => {
      repository.findById.mockResolvedValue(mockTag);

      await service.delete('user-1', 'tag-1');

      expect(repository.delete).toHaveBeenCalledWith('user-1', 'tag-1');
    });

    it('throws NotFoundDomainException (404) if tag to delete does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('user-1', 'unknown')).rejects.toThrow(NotFoundDomainException);
    });
  });
});
