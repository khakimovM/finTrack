import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramLifecycleService } from './telegram-lifecycle.service';
import { AuthHandlers } from './handlers/auth.handlers';
import { MenuHandlers } from './handlers/menu.handlers';
import { EntryHandlers } from './handlers/entry.handlers';
import { DebtHandlers } from './handlers/debt.handlers';
import { VoiceHandlers } from './handlers/voice.handlers';
import { CardHandlers } from './handlers/card.handlers';
import { CardImportRepository } from './cards/card-import.repository';
import { CardImportService } from './cards/card-import.service';
import { CardIntakeService } from './cards/card-intake.service';
import { CardDecisionsService } from './cards/card-decisions.service';
import { CardLedgerService } from './cards/card-ledger.service';
import { CardScreensService } from './cards/card-screens.service';
import { CardImportProcessor } from './cards/card-import.processor';
import { BotUserService } from './bot-user.service';
import { BotReportsService } from './bot-reports.service';
import { EntryService } from './entry.service';
import { DraftStore } from './drafts/draft.store';
import { TelegramOutboxProcessor } from './outbox/telegram-outbox.processor';
import { DailyDigestService } from './outbox/daily-digest.service';
import { DailyDigestProcessor } from './outbox/daily-digest.processor';
import { DailyRemindersService } from './outbox/daily-reminders.service';
import { DailyRemindersProcessor } from './outbox/daily-reminders.processor';
import { MonthlyReportService } from './outbox/monthly-report.service';
import { MonthlyReportProcessor } from './outbox/monthly-report.processor';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { TransfersModule } from '../transfers/transfers.module';
import { StatsModule } from '../stats/stats.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { DebtsModule } from '../debts/debts.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssistantModule } from '../assistant/assistant.module';
import { AdminCoreModule } from '../admin/core/admin-core.module';
import { QUEUES } from '../../infra/queue/queues';
import { TtsModule } from '../../infra/tts/tts.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.TELEGRAM_OUTBOX },
      { name: QUEUES.DAILY_DIGEST },
      { name: QUEUES.DAILY_REMINDERS },
      { name: QUEUES.MONTHLY_REPORT },
      { name: QUEUES.CARD_IMPORT },
    ),
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    TransfersModule,
    StatsModule,
    BudgetsModule,
    DebtsModule,
    UsersModule,
    NotificationsModule,
    AssistantModule,
    AdminCoreModule,
    TtsModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [
    TelegramLifecycleService,
    AuthHandlers,
    MenuHandlers,
    EntryHandlers,
    DebtHandlers,
    VoiceHandlers,
    CardHandlers,
    CardImportRepository,
    CardImportService,
    CardIntakeService,
    CardDecisionsService,
    CardLedgerService,
    CardScreensService,
    CardImportProcessor,
    BotUserService,
    BotReportsService,
    EntryService,
    DraftStore,
    TelegramOutboxProcessor,
    DailyDigestService,
    DailyDigestProcessor,
    DailyRemindersService,
    DailyRemindersProcessor,
    MonthlyReportService,
    MonthlyReportProcessor,
  ],
  exports: [EntryService, EntryHandlers, DraftStore, BotUserService],
})
export class TelegramModule {}
