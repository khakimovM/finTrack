import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramLifecycleService } from './telegram-lifecycle.service';
import { AuthHandlers } from './handlers/auth.handlers';
import { MenuHandlers } from './handlers/menu.handlers';
import { EntryHandlers } from './handlers/entry.handlers';
import { DebtHandlers } from './handlers/debt.handlers';
import { VoiceHandlers } from './handlers/voice.handlers';
import { BotUserService } from './bot-user.service';
import { BotReportsService } from './bot-reports.service';
import { EntryService } from './entry.service';
import { DraftStore } from './drafts/draft.store';
import { TelegramOutboxProcessor } from './outbox/telegram-outbox.processor';
import { DailyDigestService } from './outbox/daily-digest.service';
import { DailyDigestProcessor } from './outbox/daily-digest.processor';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { StatsModule } from '../stats/stats.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { DebtsModule } from '../debts/debts.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssistantModule } from '../assistant/assistant.module';
import { QUEUES } from '../../infra/queue/queues';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.TELEGRAM_OUTBOX }, { name: QUEUES.DAILY_DIGEST }),
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    StatsModule,
    BudgetsModule,
    DebtsModule,
    UsersModule,
    NotificationsModule,
    AssistantModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [
    TelegramLifecycleService,
    AuthHandlers,
    MenuHandlers,
    EntryHandlers,
    DebtHandlers,
    VoiceHandlers,
    BotUserService,
    BotReportsService,
    EntryService,
    DraftStore,
    TelegramOutboxProcessor,
    DailyDigestService,
    DailyDigestProcessor,
  ],
  exports: [EntryService, EntryHandlers, DraftStore, BotUserService],
})
export class TelegramModule {}
