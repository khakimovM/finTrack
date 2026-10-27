import { HttpStatus, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AppLocale, ExportTransactionsQuery, formatIsoDate, tiyinToSom } from '@fintrack/shared';
import {
  TransactionsRepository,
  TransactionWithRelations,
} from '../transactions/transactions.repository';
import { DomainException } from '../../common/exceptions/domain.exception';
import { escapeCsvField, neutralizeFormula } from '../../common/utils/csv';
import { EXPORT_TEXTS } from './export-texts';

/** Keeps a single export bounded in memory; larger ranges must be split by date. */
export const EXPORT_MAX_ROWS = 50_000;

@Injectable()
export class ExportService {
  constructor(private readonly transactionsRepository: TransactionsRepository) {}

  async generateCsv(userId: string, query: ExportTransactionsQuery, locale: AppLocale = 'uz'): Promise<string> {
    const transactions = await this.load(userId, query);

    const headers = EXPORT_TEXTS[locale].headers;
    const rows = transactions.map((t) => this.mapToCsvRow(t, locale));
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

    // UTF-8 BOM so Excel detects the encoding of Uzbek and Russian text.
    return `\uFEFF${csvContent}`;
  }

  async generateXlsx(userId: string, query: ExportTransactionsQuery, locale: AppLocale = 'uz'): Promise<Buffer> {
    const transactions = await this.load(userId, query);
    const texts = EXPORT_TEXTS[locale];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FinTrack';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(texts.sheet, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const [date, type, account, category, amount, tags, note] = texts.headers;
    worksheet.columns = [
      { header: date, key: 'date', width: 14 },
      { header: type, key: 'type', width: 22 },
      { header: account, key: 'account', width: 24 },
      { header: category, key: 'category', width: 24 },
      { header: amount, key: 'amount', width: 20 },
      { header: tags, key: 'tags', width: 25 },
      { header: note, key: 'note', width: 35 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    for (const t of transactions) {
      const row = worksheet.addRow({
        date: formatIsoDate(t.date),
        type: texts.types[t.type] || t.type,
        account: neutralizeFormula(t.account.name),
        category: neutralizeFormula(t.category?.name ?? '—'),
        // Excel stores numbers as doubles: exact to the tiyin below 2^53 tiyin (~90 trillion so'm).
        amount: Number(tiyinToSom(t.amount)),
        tags: neutralizeFormula(t.tags.map((tagRel) => tagRel.tag.name).join(', ')),
        note: neutralizeFormula(t.note ?? ''),
      });

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

  private async load(userId: string, query: ExportTransactionsQuery): Promise<TransactionWithRelations[]> {
    const count = await this.transactionsRepository.countForExport(userId, query);
    if (count > EXPORT_MAX_ROWS) {
      throw new DomainException(
        `Eksport ${EXPORT_MAX_ROWS} ta yozuvdan oshmasligi kerak. Sana oralig‘ini qisqartiring`,
        'EXPORT_TOO_LARGE',
        HttpStatus.UNPROCESSABLE_ENTITY,
        { count, max: EXPORT_MAX_ROWS },
      );
    }
    return this.transactionsRepository.findForExport(userId, query);
  }

  private mapToCsvRow(t: TransactionWithRelations, locale: AppLocale): string[] {
    return [
      formatIsoDate(t.date),
      EXPORT_TEXTS[locale].types[t.type] || t.type,
      escapeCsvField(t.account.name),
      escapeCsvField(t.category?.name ?? '—'),
      tiyinToSom(t.amount),
      escapeCsvField(t.tags.map((tr) => tr.tag.name).join('; ')),
      escapeCsvField(t.note ?? ''),
    ];
  }
}
