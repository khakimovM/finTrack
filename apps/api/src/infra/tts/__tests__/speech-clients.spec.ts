import { ConfigService } from '@nestjs/config';
import { AzureSpeechClient, uzbekForSpeech } from '../azure-speech.client';
import { GeminiSpeechClient, plainApostrophes, rawAudioOf, speechPrompt } from '../gemini-speech.client';
import { speechProvidersFrom } from '../tts.module';
import { SpeechProviderError } from '../tts.types';

function fakeFetch(response: Response) {
  return jest.fn(async (_url: string | URL | Request, _init?: RequestInit) => response);
}

async function failure(work: Promise<unknown>): Promise<SpeechProviderError> {
  const err = await work.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(err instanceof SpeechProviderError)) throw new Error(`expected a SpeechProviderError, got ${String(err)}`);
  return err;
}

describe('AzureSpeechClient', () => {
  const options = { id: 'azure-free', key: 'k'.repeat(32), region: 'westeurope', free: true, monthlyChars: 500_000 };

  it('asks for OGG/Opus in the Uzbek voice, with the text escaped and the oʻ/gʻ sign Azure reads', async () => {
    const fetch = fakeFetch(new Response(Buffer.from('OggS')));
    const client = new AzureSpeechClient(options, fetch as unknown as typeof globalThis.fetch);

    expect(await client.synthesize('Bo‘sh <emas> & to‘g‘ri', 'uz')).toEqual(Buffer.from('OggS'));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(init?.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': options.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'ogg-48khz-16bit-mono-opus',
    });
    expect(init?.body).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="uz-UZ">' +
        '<voice name="uz-UZ-SardorNeural">Boʻsh &lt;emas&gt; &amp; toʻgʻri</voice></speak>',
    );
    expect(client.minIntervalMs).toBe(3_100);
  });

  it('tells a rate limit, a refused key and anything else apart', async () => {
    const answer = (status: number, headers: Record<string, string> = {}) =>
      new AzureSpeechClient(options, fakeFetch(new Response(null, { status, headers })) as unknown as typeof fetch);

    expect(await failure(answer(429, { 'Retry-After': '12' }).synthesize('a', 'uz'))).toMatchObject({ reason: 'rate', retryAfterSeconds: 12 });
    expect(await failure(answer(403).synthesize('a', 'uz'))).toMatchObject({ reason: 'auth' });
    expect(await failure(answer(500).synthesize('a', 'uz'))).toMatchObject({ reason: 'failed' });
  });

  it('normalizes only the apostrophe after o and g', () => {
    expect(uzbekForSpeech("O'zbekiston, g'alaba, ma'lumot, to`g’ri")).toBe('Oʻzbekiston, gʻalaba, ma\'lumot, toʻgʻri');
  });
});

describe('GeminiSpeechClient', () => {
  const options = { id: 'gemini-free', key: 'g'.repeat(39), model: 'gemini-3.8-flash-lite-tts', free: true };
  const audioAnswer = (mimeType: string) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType, data: Buffer.from('pcm').toString('base64') } }] } }] }));

  it('asks for audio only and turns the PCM it gets into OGG/Opus', async () => {
    const fetch = fakeFetch(audioAnswer('audio/L16;codec=pcm;rate=24000'));
    const encode = jest.fn(async () => Buffer.from('OggS'));
    const client = new GeminiSpeechClient(options, fetch as unknown as typeof globalThis.fetch, encode);

    expect(await client.synthesize('Salom', 'uz')).toEqual(Buffer.from('OggS'));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent');
    expect(JSON.parse(String(init?.body))).toMatchObject({ generationConfig: { responseModalities: ['AUDIO'] } });
    expect(encode).toHaveBeenCalledWith(Buffer.from('pcm'), { format: 'pcm', sampleRate: 24_000 });
  });

  it('asks for a native Tashkent accent, with o‘ and g‘ written as the chosen sample had them', async () => {
    const fetch = fakeFetch(audioAnswer('audio/wav'));
    const client = new GeminiSpeechClient(options, fetch as unknown as typeof globalThis.fetch, jest.fn(async () => Buffer.from('OggS')));

    await client.synthesize('To‘g‘ri, oʻn ming so‘m.', 'uz');
    const sent = JSON.parse(String(fetch.mock.calls[0][1]?.body)) as { contents: Array<{ parts: Array<{ text: string }> }> };
    const [delivery, text] = sent.contents[0].parts[0].text.split('\n\n');
    expect(delivery).toMatch(/^Read the following Uzbek text aloud as a native Uzbek speaker from Tashkent/);
    expect(delivery).toContain('no foreign accent');
    expect(text).toBe("To'g'ri, o'n ming so'm.");
    expect(speechPrompt('Привет', 'ru')).toMatch(/^Read the following Russian text[\s\S]*\n\nПривет$/);
    expect(plainApostrophes('gʻ g’ g‘ g` gʼ')).toBe("g' g' g' g' g'");
  });

  it('tells a rate limit (with Google’s retry delay), a refused key and an answer without audio apart', async () => {
    const answer = (response: Response) =>
      new GeminiSpeechClient(options, fakeFetch(response) as unknown as typeof fetch, jest.fn());
    const limited = new Response(
      JSON.stringify({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '21s' }] } }),
      { status: 429 },
    );

    const spentDay = new Response(
      JSON.stringify({
        error: {
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
              violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
            },
            { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '21s' },
          ],
        },
      }),
      { status: 429 },
    );

    expect(await failure(answer(limited).synthesize('a', 'uz'))).toMatchObject({ reason: 'rate', retryAfterSeconds: 21 });
    expect(await failure(answer(spentDay).synthesize('a', 'uz'))).toMatchObject({ reason: 'quota' });
    expect(await failure(answer(new Response('{}', { status: 404 })).synthesize('a', 'uz'))).toMatchObject({ reason: 'auth' });
    expect(await failure(answer(new Response('{"candidates":[]}')).synthesize('a', 'uz'))).toMatchObject({ reason: 'failed' });
  });

  it('reads the audio format from the MIME type', () => {
    expect(rawAudioOf('audio/L16;codec=pcm;rate=16000')).toEqual({ format: 'pcm', sampleRate: 16_000 });
    expect(rawAudioOf('audio/pcm')).toEqual({ format: 'pcm', sampleRate: 24_000 });
    expect(rawAudioOf('audio/wav')).toEqual({ format: 'wav' });
  });
});

describe('speechProvidersFrom', () => {
  const config = (env: Record<string, string | number>) => ({ get: (key: string) => env[key] }) as unknown as ConfigService;
  const keys = { GEMINI_API_KEY: 'g'.repeat(39), AZURE_SPEECH_KEY: 'a'.repeat(84), AZURE_SPEECH_REGION: 'eastus' };

  it('tries the voices the owner chose in their order: Gemini Flash, Gemini Flash Lite, then Azure', () => {
    expect(speechProvidersFrom(config(keys)).map((p) => [p.id, p.free])).toEqual([
      ['gemini-free:gemini-3.8-flash-tts', true],
      ['gemini-free:gemini-3.8-flash-lite-tts', true],
      ['azure-free', true],
    ]);
  });

  it('takes the Gemini models from the settings, and the paid fallback on the cheapest one', () => {
    const providers = speechProvidersFrom(
      config({ ...keys, GEMINI_TTS_MODELS: ' gemini-x-tts , ', TTS_PAID_PROVIDER: 'gemini', TTS_PAID_KEY: 'p'.repeat(39) }),
    );
    expect(providers.map((p) => p.id)).toEqual(['gemini-free:gemini-x-tts', 'azure-free', 'gemini-paid']);
    expect(speechProvidersFrom(config({ AZURE_SPEECH_KEY: keys.AZURE_SPEECH_KEY })).length).toBe(0);
  });
});
