import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantProviderError } from '../assistant.types';

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_AFTER_SECONDS = 60;

/**
 * Whisper spells words the way its prompt does, so the prompt shows the vocabulary we expect:
 * Uzbek in Latin script, Russian in Cyrillic, amounts as digits. No language is forced because
 * users switch languages mid-sentence.
 */
const VOCABULARY_PROMPT =
  'Taksiga 20 000 so‘m, tushlikka 45 ming. Oylik tushdi 8 mln. Kecha bozorga 150 ming. ' +
  'Такси 20 тысяч, обед 45 тысяч, зарплата пришла.';

/** Fallback speech-to-text (Groq-hosted Whisper) for when Gemini is unavailable or out of quota. */
@Injectable()
export class GroqSpeechToText {
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GROQ_API_KEY');
    this.model = config.get<string>('GROQ_STT_MODEL') ?? 'whisper-large-v3';
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  async transcribe(audio: Buffer, fileName: string, mimeType: string): Promise<string> {
    if (!this.apiKey) throw new AssistantProviderError('groq', 'unavailable');

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), fileName);
    form.append('model', this.model);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    form.append('prompt', VOCABULARY_PROMPT);

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AssistantProviderError('groq', 'unavailable');
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      throw new AssistantProviderError(
        'groq',
        'rate_limited',
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : DEFAULT_RETRY_AFTER_SECONDS,
      );
    }
    if (!res.ok) throw new AssistantProviderError('groq', res.status >= 500 ? 'unavailable' : 'rejected');

    const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
    if (typeof body?.text !== 'string') throw new AssistantProviderError('groq', 'bad_output');
    return body.text.trim();
  }
}
