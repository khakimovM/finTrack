import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantProviderError, parseJson } from '../assistant.types';
import { Extraction, ExtractionSchema, GEMINI_EXTRACTION_SCHEMA } from '../extraction.schema';
import { EXTRACTION_INSTRUCTIONS, ExtractionContext, textPrompt, voicePrompt } from '../extraction.prompt';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_AFTER_SECONDS = 60;

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/**
 * Gemini over plain REST (`models/{model}:generateContent`): one call turns a voice note into a
 * transcript plus structured entries. Also used for free text the local parser gave up on.
 */
@Injectable()
export class GeminiClient {
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY');
    this.model = config.get<string>('GEMINI_MODEL') ?? 'gemini-3.8-flash';
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
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

  private async generate(parts: GeminiPart[]): Promise<Extraction> {
    if (!this.apiKey) throw new AssistantProviderError('gemini', 'unavailable');

    let res: Response;
    try {
      res = await fetch(`${API_ROOT}/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
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

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      throw new AssistantProviderError(
        'gemini',
        'rate_limited',
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : DEFAULT_RETRY_AFTER_SECONDS,
      );
    }
    if (!res.ok) throw new AssistantProviderError('gemini', res.status >= 500 ? 'unavailable' : 'rejected');

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
}
