import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExportService } from './export.service';
import { ExportTransactionsQueryDto } from './dto/export.dto';

@ApiTags('export')
@ApiBearerAuth()
@Controller({ path: 'export', version: '1' })
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @Get('transactions.csv')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Tranzaksiyalarni CSV formatida eksport qilish' })
  async exportCsv(
    @CurrentUser('id') userId: string,
    @Query() query: ExportTransactionsQueryDto,
    @Res() res: FastifyReply,
  ) {
    const csv = await this.service.generateCsv(userId, query);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  }

  @Get('transactions.xlsx')
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({ summary: 'Tranzaksiyalarni Excel (XLSX) formatida eksport qilish' })
  async exportXlsx(
    @CurrentUser('id') userId: string,
    @Query() query: ExportTransactionsQueryDto,
    @Res() res: FastifyReply,
  ) {
    const buffer = await this.service.generateXlsx(userId, query);
    res.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.header('Content-Disposition', 'attachment; filename="transactions.xlsx"');
    res.send(buffer);
  }
}
