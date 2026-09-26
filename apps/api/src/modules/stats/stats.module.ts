import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { StatsRepository } from './stats.repository';
import { AccountsModule } from '../accounts/accounts.module';
import { DebtsModule } from '../debts/debts.module';

@Module({
  imports: [AccountsModule, DebtsModule],
  controllers: [StatsController],
  providers: [StatsService, StatsRepository],
  exports: [StatsService],
})
export class StatsModule {}
