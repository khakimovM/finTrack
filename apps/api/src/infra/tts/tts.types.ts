export type SpeechLocale = 'uz' | 'ru';

/** Why a provider gave no audio; it decides how long the provider is left alone. */
export type SpeechFailure = 'rate' | 'quota' | 'auth' | 'failed';

export class SpeechProviderError extends Error {
  constructor(
    readonly reason: SpeechFailure,
    message: string,
    /** When the provider says when to come back (429). */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'SpeechProviderError';
  }
}

/** One text-to-speech account. Every provider hands back what Telegram plays as a voice message. */
export interface SpeechProvider {
  /** Meter and log name, e.g. "azure-free". */
  readonly id: string;
  /** Free accounts are used first; a paid one only once they are spent. */
  readonly free: boolean;
  /** Characters a month the account gives; null when the provider counts otherwise (requests). */
  readonly monthlyChars: number | null;
  /** Gap between two calls, for providers with a per-minute limit. */
  readonly minIntervalMs: number;
  /** OGG/Opus audio. Throws SpeechProviderError. */
  synthesize(text: string, locale: SpeechLocale): Promise<Buffer>;
}

export const SPEECH_PROVIDERS = Symbol('SPEECH_PROVIDERS');
