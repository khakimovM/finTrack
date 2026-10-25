import { SpeechLocale, SpeechProvider, SpeechProviderError } from './tts.types';

const TIMEOUT_MS = 30_000;

/** Neural voices; Azure answers in OGG/Opus itself, so no conversion is needed. */
const VOICES: Record<SpeechLocale, { lang: string; voice: string }> = {
  uz: { lang: 'uz-UZ', voice: 'uz-UZ-MadinaNeural' },
  ru: { lang: 'ru-RU', voice: 'ru-RU-SvetlanaNeural' },
};

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
}

/** Uzbek Latin writes oʻ and gʻ with U+02BB; the voice reads the letter right only with that sign. */
export function uzbekForSpeech(text: string): string {
  return text.replace(/([oOgG])[‘’'`ʼ]/g, '$1ʻ');
}

export interface AzureSpeechOptions {
  id: string;
  key: string;
  region: string;
  free: boolean;
  monthlyChars: number | null;
}

/** Azure AI Speech over REST (`cognitiveservices/v1`), without the SDK. */
export class AzureSpeechClient implements SpeechProvider {
  readonly id: string;
  readonly free: boolean;
  readonly monthlyChars: number | null;
  // The free tier allows 20 requests a minute.
  readonly minIntervalMs: number;

  constructor(
    private readonly options: AzureSpeechOptions,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.id = options.id;
    this.free = options.free;
    this.monthlyChars = options.monthlyChars;
    this.minIntervalMs = options.free ? 3_100 : 0;
  }

  async synthesize(text: string, locale: SpeechLocale): Promise<Buffer> {
    const { lang, voice } = VOICES[locale];
    const spoken = locale === 'uz' ? uzbekForSpeech(text) : text;
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
      `<voice name="${voice}">${escapeXml(spoken)}</voice></speak>`;

    let response: Response;
    try {
      response = await this.fetchImpl(`https://${this.options.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.options.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'ogg-48khz-16bit-mono-opus',
          'User-Agent': 'FinTrack',
        },
        body: ssml,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err: unknown) {
      throw new SpeechProviderError('failed', `azure: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    if (response.status === 429) {
      throw new SpeechProviderError('rate', 'azure: 429', Number.isFinite(retryAfter) ? retryAfter : undefined);
    }
    // A spent free tier answers 403 as well as a wrong key does.
    if (response.status === 401 || response.status === 403) throw new SpeechProviderError('auth', `azure: ${response.status}`);
    throw new SpeechProviderError('failed', `azure: ${response.status}`);
  }
}
