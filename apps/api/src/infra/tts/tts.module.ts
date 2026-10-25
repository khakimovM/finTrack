import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureSpeechClient } from './azure-speech.client';
import { DEFAULT_GEMINI_TTS_MODEL, GeminiSpeechClient } from './gemini-speech.client';
import { TtsService } from './tts.service';
import { SPEECH_PROVIDERS, SpeechProvider } from './tts.types';

/**
 * The accounts, cheapest first: Azure's free tier (F0 never bills), Gemini on the assistant's
 * key (a free key without billing), then the one paid provider, off unless TTS_PAID_PROVIDER is set.
 */
export function speechProvidersFrom(config: ConfigService): SpeechProvider[] {
  const providers: SpeechProvider[] = [];
  const region = config.get<string>('AZURE_SPEECH_REGION');
  const azureKey = config.get<string>('AZURE_SPEECH_KEY');
  if (azureKey && region) {
    const monthlyChars = config.get<number>('AZURE_TTS_FREE_CHARS') ?? 500_000;
    providers.push(new AzureSpeechClient({ id: 'azure-free', key: azureKey, region, free: true, monthlyChars }));
  }

  const model = config.get<string>('GEMINI_TTS_MODEL') ?? DEFAULT_GEMINI_TTS_MODEL;
  const geminiKey = config.get<string>('GEMINI_API_KEY');
  if (geminiKey) providers.push(new GeminiSpeechClient({ id: 'gemini-free', key: geminiKey, model, free: true }));

  const paid = config.get<string>('TTS_PAID_PROVIDER');
  const paidKey = config.get<string>('TTS_PAID_KEY');
  if (paid === 'azure' && paidKey && region) {
    providers.push(new AzureSpeechClient({ id: 'azure-paid', key: paidKey, region, free: false, monthlyChars: null }));
  }
  if (paid === 'gemini' && paidKey) {
    providers.push(new GeminiSpeechClient({ id: 'gemini-paid', key: paidKey, model, free: false }));
  }
  return providers;
}

@Module({
  providers: [{ provide: SPEECH_PROVIDERS, inject: [ConfigService], useFactory: speechProvidersFrom }, TtsService],
  exports: [TtsService],
})
export class TtsModule {}
