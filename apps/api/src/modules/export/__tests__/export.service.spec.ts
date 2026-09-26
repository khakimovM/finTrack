import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from '../export.service';
import { TransactionsRepository } from '../../transactions/transactions.repository';
import { parseIsoDate } from '@fintrack/shared';

describe('ExportService', () => {
  let service: ExportService;
  let repository: jest.Mocked<TransactionsRepository>;

  const mockUserId = 'user-123';
  const mockTransactions = [
    {
      id: 'tx-1',
      userId: mockUserId,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: 'EXPENSE' as const,
      amount: 15000000n, // 150 000 so'm
      date: parseIsoDate('2026-09-01'),
      note: 'Bozorlik, oziq-ovqat',
      debtId: null,
      transferGroupId: null,
      recurringRuleId: null,
      deletedAt: null,
      createdAt: new Date('2026-09-01T10:00:00Z'),
      updatedAt: new Date('2026-09-01T10:00:00Z'),
      account: { id: 'acc-1', name: 'Humo karta', icon: '💳' },
      category: { id: 'cat-1', name: 'Oziq-ovqat', icon: '🛒', color: '#10b981' },
      tags: [{ tag: { id: 'tag-1', name: 'Supermarket', color: '#6366f1' } }],
    },
    {
      id: 'tx-2',
      userId: mockUserId,
      accountId: 'acc-1',
      categoryId: 'cat-2',
      type: 'INCOME' as const,
      amount: 500000000n, // 5 000 000 so'm
      date: parseIsoDate('2026-09-02'),
      note: 'Oylik maosh',
      debtId: null,
      transferGroupId: null,
      recurringRuleId: null,
      deletedAt: null,
      createdAt: new Date('2026-09-02T10:00:00Z'),
      updatedAt: new Date('2026-09-02T10:00:00Z'),
      account: { id: 'acc-1', name: 'Humo karta', icon: '💳' },
      category: { id: 'cat-2', name: 'Maosh', icon: '💰', color: '#22c55e' },
      tags: [],
    },
  ];

  beforeEach(async () => {
    const mockRepo = {
      findForExport: jest.fn().mockResolvedValue(mockTransactions),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: TransactionsRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
    repository = module.get(TransactionsRepository);
  });

  describe('generateCsv', () => {
    it('generates valid CSV with UTF-8 BOM, headers and formatted values', async () => {
      const csv = await service.generateCsv(mockUserId, { from: '2026-09-01', to: '2026-09-02' });

      expect(repository.findForExport).toHaveBeenCalledWith(mockUserId, {
        from: '2026-09-01',
        to: '2026-09-02',
      });

      // Starts with UTF-8 BOM
      expect(csv.startsWith('\uFEFF')).toBe(true);

      // Contains header row
      expect(csv).toContain('Sana,Tur,Hisob,Kategoriya,Summa (so‘m),Teglar,Izoh');

      // Contains Chiqim with correct amount formatting
      expect(csv).toContain('2026-09-01,Chiqim,Humo karta,Oziq-ovqat,150000.00,Supermarket,"Bozorlik, oziq-ovqat"');

      // Contains Kirim with correct amount formatting
      expect(csv).toContain('2026-09-02,Kirim,Humo karta,Maosh,5000000.00,,Oylik maosh');
    });
  });

  describe('generateXlsx', () => {
    it('generates a valid XLSX buffer with data', async () => {
      const buffer = await service.generateXlsx(mockUserId, {});

      expect(repository.findForExport).toHaveBeenCalledWith(mockUserId, {});
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });
});
