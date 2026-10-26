import { GeminiErrorBody, isDailyQuota, retryDelaySeconds } from '../../common/utils/gemini-errors';
import { RawAudio, toOggOpus } from './ogg-opus';
import { SpeechLocale, SpeechProvider, SpeechProviderError } from './tts.types';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 60_000;
/** Tried in order on a key without billing; the full model sounded the most Uzbek, Lite next. */
export const DEFAULT_GEMINI_TTS_MODELS = 'gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts';
/** For the paid fallback. */
export const CHEAPEST_GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const VOICE = 'Kore';

// Without it the voice reads Uzbek with a foreign accent. It is taken as direction, not read aloud.
const DELIVERY: Record<SpeechLocale, string> = {
  uz:
    'Read the following Uzbek text aloud as a native Uzbek speaker from Tashkent would: natural Uzbek pronunciation ' +
    'and intonation, no foreign accent, a warm and calm news-presenter tone, unhurried.',
  ru:
    'Read the following Russian text aloud as a native Russian speaker would: natural pronunciation and intonation, ' +
    'a warm and calm news-presenter tone, unhurried.',
};

/** The sample the owner chose was read from o' and g' written with a plain apostrophe. */
export function plainApostrophes(text: string): string {
  return text.replace(/[‘’ʻʼ`]/g, "'");
}

/** What Gemini is asked to read: the delivery note, then the text. */
export function speechPrompt(text: string, locale: SpeechLocale): string {
  return `${DELIVERY[locale]}\n\n${locale === 'uz' ? plainApostrophes(text) : text}`;
}

interface GeminiAudioResponse {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
}

/** "audio/L16;codec=pcm;rate=24000" is raw PCM; anything else is taken as WAV. */
export function rawAudioOf(mimeType: string): RawAudio {
  if (!/^audio\/(l16|pcm)/i.test(mimeType)) return { format: 'wav' };
  const rate = Number.parseInt(/rate=(\d+)/i.exec(mimeType)?.[1] ?? '', 10);
  return { format: 'pcm', sampleRate: Number.isFinite(rate) ? rate : 24_000 };
}

export interface GeminiSpeechOptions {
  id: string;
  key: string;
  model: string;
  free: boolean;
}

/**
 * Gemini speech generation over REST. The language is taken from the text itself, the accent from
 * the delivery note; the answer is PCM or WAV, turned into OGG/Opus with opusenc.
 */
export class GeminiSpeechClient implements SpeechProvider {
  readonly id: string;
  readonly free: boolean;
  // Counted in requests a day, not characters: a spent day answers 429.
  readonly monthlyChars = null;
  readonly minIntervalMs = 0;

  constructor(
    private readonly options: GeminiSpeechOptions,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly encode: typeof toOggOpus = toOggOpus,
  ) {
    this.id = options.id;
    this.free = options.free;
  }

  async synthesize(text: string, locale: SpeechLocale): Promise<Buffer> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API_ROOT}/models/${this.options.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.options.key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: speechPrompt(text, locale) }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err: unknown) {
      throw new SpeechProviderError('failed', `gemini: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as GeminiErrorBody | null;
      if (response.status === 429) {
        if (isDailyQuota(body)) throw new SpeechProviderError('quota', 'gemini: 429, the day is spent');
        throw new SpeechProviderError('rate', 'gemini: 429', retryDelaySeconds(body) ?? undefined);
      }
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        throw new SpeechProviderError('auth', `gemini: ${response.status}`);
      }
      throw new SpeechProviderError('failed', `gemini: ${response.status}`);
    }

    const body = (await response.json().catch(() => null)) as GeminiAudioResponse | null;
    const audio = body?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!audio?.data) throw new SpeechProviderError('failed', 'gemini: no audio in the answer');

    try {
      return await this.encode(Buffer.from(audio.data, 'base64'), rawAudioOf(audio.mimeType ?? ''));
    } catch (err: unknown) {
      throw new SpeechProviderError('failed', `gemini: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
