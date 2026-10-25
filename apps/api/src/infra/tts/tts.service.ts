import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ClockService } from '../clock/clock.service';
import { SPEECH_PROVIDERS, SpeechFailure, SpeechLocale, SpeechProvider, SpeechProviderError } from './tts.types';

/** A free allowance is left before it runs out: the meter can lag behind the provider's own. */
const FREE_SHARE = 0.95;
const METER_TTL_SECONDS = 40 * 24 * 3600;
/** A short "too many requests" is waited out once on the same provider instead of moving on. */
const MAX_WAIT_SECONDS = 30;

const COOL_DOWN_SECONDS: Record<SpeechFailure, number> = {
  rate: 60,
  quota: 24 * 3600,
  // A wrong key or a spent free tier: retried hourly, not on every message.
  auth: 3600,
  failed: 300,
};

export interface Speech {
  audio: Buffer;
  provider: string;
}

export interface SpeechUsage {
  provider: string;
  free: boolean;
  chars: number;
  limit: number | null;
  available: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Text to a voice message at the lowest cost: free accounts first, in order, each until its
 * monthly allowance is nearly spent or it refuses; the paid one only after them. Without any
 * provider it answers null and the caller sends text only.
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly chain: SpeechProvider[];
  private readonly lastCallAt = new Map<string, number>();

  constructor(
    @Inject(SPEECH_PROVIDERS) providers: SpeechProvider[],
    private readonly redis: RedisService,
    private readonly clock: ClockService,
  ) {
    this.chain = [...providers.filter((p) => p.free), ...providers.filter((p) => !p.free)];
  }

  get enabled(): boolean {
    return this.chain.length > 0;
  }

  async speak(text: string, locale: SpeechLocale): Promise<Speech | null> {
    for (const provider of this.chain) {
      if (!(await this.usable(provider, text.length))) continue;
      try {
        const audio = await this.call(provider, text, locale);
        await this.redis.incrByWithTtl(this.meterKey(provider), text.length, METER_TTL_SECONDS);
        return { audio, provider: provider.id };
      } catch (err: unknown) {
        await this.coolDown(provider, err);
      }
    }
    return null;
  }

  /** This month's characters per provider, for the admin system page. */
  async usage(): Promise<SpeechUsage[]> {
    return Promise.all(
      this.chain.map(async (provider) => ({
        provider: provider.id,
        free: provider.free,
        chars: Number((await this.redis.get(this.meterKey(provider))) ?? 0),
        limit: provider.monthlyChars,
        available: (await this.redis.get(this.offKey(provider))) === null,
      })),
    );
  }

  private async usable(provider: SpeechProvider, length: number): Promise<boolean> {
    if ((await this.redis.get(this.offKey(provider))) !== null) return false;
    if (provider.monthlyChars === null) return true;
    const used = Number((await this.redis.get(this.meterKey(provider))) ?? 0);
    return used + length <= provider.monthlyChars * FREE_SHARE;
  }

  private async call(provider: SpeechProvider, text: string, locale: SpeechLocale): Promise<Buffer> {
    for (let attempt = 0; ; attempt++) {
      const wait = (this.lastCallAt.get(provider.id) ?? 0) + provider.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastCallAt.set(provider.id, Date.now());
      try {
        return await provider.synthesize(text, locale);
      } catch (err: unknown) {
        const shortWait = err instanceof SpeechProviderError && err.reason === 'rate' ? (err.retryAfterSeconds ?? 5) : null;
        if (attempt > 0 || shortWait === null || shortWait > MAX_WAIT_SECONDS) throw err;
        await sleep(shortWait * 1000);
      }
    }
  }

  private async coolDown(provider: SpeechProvider, err: unknown): Promise<void> {
    const reason: SpeechFailure = err instanceof SpeechProviderError ? err.reason : 'failed';
    const seconds =
      (err instanceof SpeechProviderError && reason === 'rate' ? err.retryAfterSeconds : undefined) ?? COOL_DOWN_SECONDS[reason];
    this.logger.warn(`Speech provider ${provider.id} left for ${seconds}s: ${err instanceof Error ? err.message : String(err)}`);
    await this.redis.set(this.offKey(provider), reason, seconds);
  }

  private meterKey(provider: SpeechProvider): string {
    return `tts:chars:${provider.id}:${this.clock.now().toISOString().slice(0, 7)}`;
  }

  private offKey(provider: SpeechProvider): string {
    return `tts:off:${provider.id}`;
  }
}
