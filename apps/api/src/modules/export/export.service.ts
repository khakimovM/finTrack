import { Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import {
  ExportTransactionsQuery,
  formatIsoDate,
  tiyinToSom,
} from '@fintrack/shared';
import {
  TransactionsRepository,
  TransactionWithRelations,
} from '../transactions/transactions.repository';

const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: 'Kirim',
  EXPENSE: 'Chiqim',
  TRANSFER_IN: 'O‘tkazma (kirim)',
  TRANSFER_OUT: 'O‘tkazma (chiqim)',
  LOAN_GIVEN: 'Qarz berildi',
  LOAN_TAKEN: 'Qarz olindi',
  LOAN_REPAY_IN: 'Qarz qaytarildi (kirim)',
  LOAN_REPAY_OUT: 'Qarz qaytarildi (chiqim)',
  ADJUSTMENT: 'Tuzatish',
};

function escapeCsvField(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

@Injectable()
export class ExportService {
  constructor(private readonly transactionsRepository: TransactionsRepository) {}

  async generateCsv(userId: string, query: ExportTransactionsQuery): Promise<string> {
    const transactions = await this.transactionsRepository.findForExport(userId, query);

    const headers = ['Sana', 'Tur', 'Hisob', 'Kategoriya', 'Summa (so‘m)', 'Teglar', 'Izoh'];
    const rows = transactions.map((t) => this.mapToCsvRow(t));

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

    // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility
    return `\uFEFF${csvContent}`;
  }

  async generateXlsx(userId: string, query: ExportTransactionsQuery): Promise<Buffer> {
    const transactions = await this.transactionsRepository.findForExport(userId, query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FinTrack';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Tranzaksiyalar', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = [
      { header: 'Sana', key: 'date', width: 14 },
      { header: 'Tur', key: 'type', width: 22 },
      { header: 'Hisob', key: 'account', width: 24 },
      { header: 'Kategoriya', key: 'category', width: 24 },
      { header: 'Summa (so‘m)', key: 'amount', width: 20 },
      { header: 'Teglar', key: 'tags', width: 25 },
      { header: 'Izoh', key: 'note', width: 35 },
    ];

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    for (const t of transactions) {
      const somValue = Number(t.amount) / 100;
      const row = worksheet.addRow({
        date: formatIsoDate(t.date),
        type: TYPE_LABELS[t.type] || t.type,
        account: t.account.name,
        category: t.category?.name ?? '—',
        amount: somValue,
        tags: t.tags.map((tagRel) => tagRel.tag.name).join(', '),
        note: t.note ?? '',
      });

      // Number formatting for amount
      const amountCell = row.getCell('amount');
      amountCell.numFmt = '#,##0.00';
      amountCell.alignment = { horizontal: 'right' };

      if (t.type === 'INCOME') {
        amountCell.font = { color: { argb: 'FF16A34A' } };
      } else if (t.type === 'EXPENSE') {
        amountCell.font = { color: { argb: 'FFE11D48' } };
      }
    }

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  private mapToCsvRow(t: TransactionWithRelations): string[] {
    const date = formatIsoDate(t.date);
    const type = TYPE_LABELS[t.type] || t.type;
    const account = escapeCsvField(t.account.name);
    const category = escapeCsvField(t.category?.name ?? '—');
    const amount = tiyinToSom(t.amount);
    const tags = escapeCsvField(t.tags.map((tr) => tr.tag.name).join('; '));
    const note = escapeCsvField(t.note ?? '');

    return [date, type, account, category, amount, tags, note];
  }
}
