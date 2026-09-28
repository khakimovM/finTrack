import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantProviderError, parseJson } from '../assistant.types';
import { Extraction, ExtractionSchema, GEMINI_EXTRACTION_SCHEMA } from '../extraction.schema';
import { EXTRACTION_INSTRUCTIONS, ExtractionContext, textPrompt, voicePrompt } from '../extraction.prompt';
import { RedisService } from '../../../infra/redis/redis.service';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 30_000;

/**
 * Fast lite models first (1-3 s, rarely overloaded on the free tier), the larger flash model as
 * extra capacity. Each model has its own free quota, so the chain adds them up.
 */
export const DEFAULT_GEMINI_MODELS = 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.6-flash';

const COOLDOWN_SECONDS = {
  rateLimitedDefault: 60,
  /** 503 "model overloaded" is common on the free tier and usually clears quickly. */
  overloaded: 30,
  /** 404: the key has no access to this model; a config problem, not worth retrying soon. */
  missing: 3600,
  max: 3600,
};

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

interface GeminiErrorBody {
  error?: { message?: string; details?: Array<{ retryDelay?: string }> };
}

/** Google sends no Retry-After header: the delay is in RetryInfo ("44s") or the message. */
export function retryDelaySeconds(body: GeminiErrorBody | null): number | null {
  const fromDetails = body?.error?.details?.find((d) => typeof d.retryDelay === 'string')?.retryDelay;
  const fromMessage = /retry in ([\d.]+)s/i.exec(body?.error?.message ?? '')?.[1];
  const seconds = Number.parseFloat(fromDetails ?? fromMessage ?? '');
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/**
 * Gemini over plain REST (`models/{model}:generateContent`): one call turns a voice note into a
 * transcript plus structured entries. Also used for free text the local parser gave up on.
 * Models are tried in order; a model that is rate limited, overloaded or missing is skipped
 * until its own cooldown ends, so the free quotas of all configured models add up.
 */
@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly apiKey?: string;
  readonly models: string[];

  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.apiKey = config.get<string>('GEMINI_API_KEY');
    this.models = (config.get<string>('GEMINI_MODELS') ?? DEFAULT_GEMINI_MODELS)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }

  get enabled(): boolean {
    return Boolean(this.apiKey) && this.models.length > 0;
  }

  extractFromAudio(audio: Buffer, mimeType: string, ctx: ExtractionContext): Promise<Extraction> {
    return this.generate([
      { inlineData: { mimeType, data: audio.toString('base64') } },
      { text: voicePrompt(ctx) },
    ]);
  }

  extractFromText(text: string, ctx: ExtractionContext): Promise<Extraction> {
    return this.generate([{ text: textPrompt(ctx, text) }]);
  }

  /**
   * The final error never carries retryAfterSeconds: cooldowns are tracked per model here, and a
   * provider-wide cooldown would also block models that are still available.
   */
  private async generate(parts: GeminiPart[]): Promise<Extraction> {
    if (!this.apiKey) throw new AssistantProviderError('gemini', 'unavailable');

    let lastReason: AssistantProviderError['reason'] = 'rate_limited';
    for (const model of this.models) {
      if ((await this.redis.get(this.cooldownKey(model))) !== null) continue;
      try {
        return await this.call(model, parts);
      } catch (err) {
        if (!(err instanceof AssistantProviderError)) throw err;
        lastReason = err.reason;
        await this.coolDown(model, err);
      }
    }
    throw new AssistantProviderError('gemini', lastReason);
  }

  private async call(model: string, parts: GeminiPart[]): Promise<Extraction> {
    let res: Response;
    try {
      res = await fetch(`${API_ROOT}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey ?? '' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: EXTRACTION_INSTRUCTIONS }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: GEMINI_EXTRACTION_SCHEMA,
            maxOutputTokens: 8192,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AssistantProviderError('gemini', 'unavailable');
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as GeminiErrorBody | null;
      if (res.status === 429) {
        throw new AssistantProviderError(
          'gemini',
          'rate_limited',
          retryDelaySeconds(body) ?? COOLDOWN_SECONDS.rateLimitedDefault,
        );
      }
      if (res.status === 404) {
        this.logger.warn(`Gemini model "${model}" is not available for this API key`);
        throw new AssistantProviderError('gemini', 'rejected', COOLDOWN_SECONDS.missing);
      }
      throw new AssistantProviderError('gemini', res.status >= 500 ? 'unavailable' : 'rejected');
    }

    const body = (await res.json().catch(() => null)) as GeminiResponse | null;
    if (body?.promptFeedback?.blockReason) throw new AssistantProviderError('gemini', 'rejected');
    const candidate = body?.candidates?.[0];
    if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) {
      throw new AssistantProviderError('gemini', candidate?.finishReason === 'SAFETY' ? 'rejected' : 'bad_output');
    }

    const text = (candidate.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
    const parsed = ExtractionSchema.safeParse(parseJson(text));
    if (!parsed.success) throw new AssistantProviderError('gemini', 'bad_output');
    return parsed.data;
  }

  private async coolDown(model: string, err: AssistantProviderError): Promise<void> {
    const seconds =
      err.reason === 'rate_limited' || err.retryAfterSeconds !== undefined
        ? err.retryAfterSeconds
        : err.reason === 'unavailable'
          ? COOLDOWN_SECONDS.overloaded
          : undefined;
    if (seconds === undefined) return;
    this.logger.warn(`Gemini model "${model}" ${err.reason}, skipping it for ${seconds}s`);
    await this.redis.set(this.cooldownKey(model), '1', Math.min(COOLDOWN_SECONDS.max, Math.max(1, seconds)));
  }

  private cooldownKey(model: string): string {
    return `ai:cooldown:gemini:${model}`;
  }
}
