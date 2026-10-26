import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureSpeechClient } from './azure-speech.client';
import { CHEAPEST_GEMINI_TTS_MODEL, DEFAULT_GEMINI_TTS_MODELS, GeminiSpeechClient } from './gemini-speech.client';
import { TtsService } from './tts.service';
import { SPEECH_PROVIDERS, SpeechProvider } from './tts.types';

/**
 * The free accounts in the order the owner liked the voices (2026-10-26): the Gemini models on the
 * assistant's key (no billing, each with its own daily quota), then Azure's F0 (never bills). The
 * one paid provider comes after them, off unless TTS_PAID_PROVIDER is set.
 */
export function speechProvidersFrom(config: ConfigService): SpeechProvider[] {
  const providers: SpeechProvider[] = [];
  const geminiKey = config.get<string>('GEMINI_API_KEY');
  if (geminiKey) {
    const models = (config.get<string>('GEMINI_TTS_MODELS') ?? DEFAULT_GEMINI_TTS_MODELS)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    for (const model of models) {
      providers.push(new GeminiSpeechClient({ id: `gemini-free:${model}`, key: geminiKey, model, free: true }));
    }
  }

  const region = config.get<string>('AZURE_SPEECH_REGION');
  const azureKey = config.get<string>('AZURE_SPEECH_KEY');
  if (azureKey && region) {
    const monthlyChars = config.get<number>('AZURE_TTS_FREE_CHARS') ?? 500_000;
    providers.push(new AzureSpeechClient({ id: 'azure-free', key: azureKey, region, free: true, monthlyChars }));
  }

  const paid = config.get<string>('TTS_PAID_PROVIDER');
  const paidKey = config.get<string>('TTS_PAID_KEY');
  if (paid === 'azure' && paidKey && region) {
    providers.push(new AzureSpeechClient({ id: 'azure-paid', key: paidKey, region, free: false, monthlyChars: null }));
  }
  if (paid === 'gemini' && paidKey) {
    providers.push(new GeminiSpeechClient({ id: 'gemini-paid', key: paidKey, model: CHEAPEST_GEMINI_TTS_MODEL, free: false }));
  }
  return providers;
}

@Module({
  providers: [{ provide: SPEECH_PROVIDERS, inject: [ConfigService], useFactory: speechProvidersFrom }, TtsService],
  exports: [TtsService],
})
export class TtsModule {}
