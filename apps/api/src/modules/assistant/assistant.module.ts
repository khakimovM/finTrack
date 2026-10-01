import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { GeminiClient } from './providers/gemini.client';
import { GroqSpeechToText } from './providers/groq-stt.client';
import { ClaudeClient } from './providers/claude.client';
import { CategoriesModule } from '../categories/categories.module';
import { AccountsModule } from '../accounts/accounts.module';

/** Voice notes and free-form text → entry candidates. Never writes to the ledger itself. */
@Module({
  imports: [CategoriesModule, AccountsModule],
  providers: [AssistantService, GeminiClient, GroqSpeechToText, ClaudeClient],
  exports: [AssistantService],
})
export class AssistantModule {}
