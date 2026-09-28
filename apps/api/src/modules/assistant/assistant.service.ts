import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { AssistantEntry, AssistantProviderError, ProviderName, toAssistantEntries } from './assistant.types';
import { Extraction } from './extraction.schema';
import { ExtractionContext } from './extraction.prompt';
import { GeminiClient } from './providers/gemini.client';
import { GroqSpeechToText } from './providers/groq-stt.client';
import { ClaudeClient } from './providers/claude.client';
import { parseQuickEntry } from '../telegram/parsing/quick-entry.parser';
import { CategoriesRepository } from '../categories/categories.repository';
import { AccountsRepository } from '../accounts/accounts.repository';
import { RedisService } from '../../infra/redis/redis.service';
import { ClockService } from '../../infra/clock/clock.service';

export interface VoiceInput {
  data: Buffer;
  mimeType: string;
  fileName: string;
}

export interface AssistantResult {
  transcript: string;
  entries: AssistantEntry[];
  debtMentioned: boolean;
}

export type AssistantOutcome =
  | { status: 'ok'; result: AssistantResult }
  /** The user's daily AI allowance is used up. */
  | { status: 'limit' }
  /** Every configured provider failed or is cooling down. */
  | { status: 'unavailable' }
  /** No provider is configured for this kind of input. */
  | { status: 'disabled' };

/** Only text that mentions a number is worth an AI call ("salom" is not an entry). */
const AMOUNT_HINT =
  /\d|ming|mln|million|milliard|yarim|yuz\b|тыс|тыщ|милл|сот|сто\b|двест|трист|пятьс|so['‘’ʼ]?m|сум/i;

export function looksLikeEntry(text: string): boolean {
  return AMOUNT_HINT.test(text);
}

const COOLDOWN_CAP_SECONDS = 600;
const LIMIT_WINDOW_SECONDS = 26 * 3600;

/**
 * Voice/text → entries, spending free quotas carefully: Gemini does transcription and
 * extraction in one call; when it is out of quota, Groq Whisper transcribes and the text goes
 * through Claude (if configured) or the local parser. Nothing here writes to the ledger.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly voiceDailyLimit: number;
  private readonly textDailyLimit: number;

  constructor(
    private readonly gemini: GeminiClient,
    private readonly groq: GroqSpeechToText,
    private readonly claude: ClaudeClient,
    private readonly categories: CategoriesRepository,
    private readonly accounts: AccountsRepository,
    private readonly redis: RedisService,
    private readonly clock: ClockService,
    config: ConfigService,
  ) {
    this.voiceDailyLimit = config.get<number>('VOICE_DAILY_LIMIT') ?? 30;
    this.textDailyLimit = config.get<number>('AI_TEXT_DAILY_LIMIT') ?? 50;
  }

  get voiceEnabled(): boolean {
    return this.gemini.enabled || this.groq.enabled;
  }

  get textEnabled(): boolean {
    return this.gemini.enabled || this.claude.enabled;
  }

  async fromVoice(user: User, voice: VoiceInput): Promise<AssistantOutcome> {
    if (!this.voiceEnabled) return { status: 'disabled' };
    if (!(await this.withinLimit(user, 'voice', this.voiceDailyLimit))) return { status: 'limit' };
    const ctx = await this.context(user);

    if (await this.available('gemini', this.gemini.enabled)) {
      try {
        return this.ok(await this.gemini.extractFromAudio(voice.data, voice.mimeType, ctx), ctx);
      } catch (err) {
        await this.recordFailure(err);
      }
    }

    if (!(await this.available('groq', this.groq.enabled))) return { status: 'unavailable' };
    let transcript: string;
    try {
      transcript = await this.groq.transcribe(voice.data, voice.fileName, voice.mimeType);
    } catch (err) {
      await this.recordFailure(err);
      return { status: 'unavailable' };
    }
    if (!transcript) return this.ok({ transcript: '', entries: [], debtMentioned: false }, ctx);

    const extraction = await this.extractText(transcript, ctx);
    return this.ok(extraction ?? this.parseLocally(transcript), ctx);
  }

  /** For chat text the local parser could not read. */
  async fromText(user: User, text: string): Promise<AssistantOutcome> {
    if (!this.textEnabled) return { status: 'disabled' };
    if (!looksLikeEntry(text)) return { status: 'ok', result: { transcript: text, entries: [], debtMentioned: false } };
    if (!(await this.withinLimit(user, 'text', this.textDailyLimit))) return { status: 'limit' };
    const ctx = await this.context(user);
    const extraction = await this.extractText(text, ctx);
    return extraction ? this.ok(extraction, ctx) : { status: 'unavailable' };
  }

  private async extractText(text: string, ctx: ExtractionContext): Promise<Extraction | null> {
    const chain: Array<[ProviderName, boolean, () => Promise<Extraction>]> = [
      ['gemini', this.gemini.enabled, () => this.gemini.extractFromText(text, ctx)],
      ['claude', this.claude.enabled, () => this.claude.extractFromText(text, ctx)],
    ];
    for (const [name, enabled, run] of chain) {
      if (!(await this.available(name, enabled))) continue;
      try {
        return await run();
      } catch (err) {
        await this.recordFailure(err);
      }
    }
    return null;
  }

  /** Last resort for a transcript: only safe when it holds exactly one amount. */
  private parseLocally(transcript: string): Extraction {
    const amounts = transcript.match(/\d[\d\s.,]*/g) ?? [];
    const parsed = amounts.length === 1 ? parseQuickEntry(transcript) : null;
    if (!parsed) return { transcript, entries: [], debtMentioned: false };
    const whole = parsed.amount / 100n;
    const cents = parsed.amount % 100n;
    return {
      transcript,
      debtMentioned: false,
      entries: [
        {
          type: parsed.type,
          amount: cents === 0n ? whole.toString() : `${whole}.${cents.toString().padStart(2, '0')}`,
          note: parsed.note,
          category: '',
          account: '',
          daysAgo: parsed.daysAgo,
        },
      ],
    };
  }

  private ok(extraction: Extraction, ctx: ExtractionContext): AssistantOutcome {
    return {
      status: 'ok',
      result: {
        transcript: extraction.transcript.trim(),
        entries: toAssistantEntries(extraction, ctx.today),
        debtMentioned: extraction.debtMentioned,
      },
    };
  }

  private async context(user: User): Promise<ExtractionContext> {
    const [roots, accounts] = await Promise.all([this.categories.findAll(user.id), this.accounts.findAll(user.id)]);
    const all = roots.flatMap((root) => [root, ...(root.children ?? [])]);
    return {
      today: this.clock.todayIn(user.timezone),
      expenseCategories: all.filter((c) => c.type === 'EXPENSE').map((c) => c.name),
      incomeCategories: all.filter((c) => c.type === 'INCOME').map((c) => c.name),
      accounts: accounts.map((a) => a.name),
    };
  }

  private async withinLimit(user: User, kind: 'voice' | 'text', limit: number): Promise<boolean> {
    const day = this.clock.todayIn(user.timezone);
    const count = await this.redis.incrWithTtl(`ai:${kind}:${user.id}:${day}`, LIMIT_WINDOW_SECONDS);
    // Redis being down must not disable the assistant; the providers' own quotas still apply.
    return count === null || count <= limit;
  }

  private async available(provider: ProviderName, enabled: boolean): Promise<boolean> {
    return enabled && (await this.redis.get(`ai:cooldown:${provider}`)) === null;
  }

  /** Logs provider and reason only: transcripts and messages are private financial data. */
  private async recordFailure(err: unknown): Promise<void> {
    if (!(err instanceof AssistantProviderError)) {
      this.logger.error(`Assistant failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    this.logger.warn(`Assistant provider failed: ${err.message}`);
    if (err.reason === 'rate_limited') {
      const ttl = Math.min(COOLDOWN_CAP_SECONDS, Math.max(1, Math.ceil(err.retryAfterSeconds ?? 60)));
      await this.redis.set(`ai:cooldown:${err.provider}`, '1', ttl);
    }
  }
}

