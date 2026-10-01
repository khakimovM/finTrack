import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AssistantProviderError, parseJson } from '../assistant.types';
import { EXTRACTION_JSON_SCHEMA, Extraction, ExtractionSchema } from '../extraction.schema';
import { EXTRACTION_INSTRUCTIONS, ExtractionContext, textPrompt } from '../extraction.prompt';

/** Server-side fallback lets another model answer when a safety classifier declines. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type ExtractionRequest = Anthropic.MessageCreateParamsNonStreaming & { fallbacks: 'default' };

/** Optional text extractor, enabled only when ANTHROPIC_API_KEY is configured (paid API). */
@Injectable()
export class ClaudeClient {
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 }) : null;
    this.model = config.get<string>('ANTHROPIC_MODEL') ?? 'claude-opus-5';
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async extractFromText(text: string, ctx: ExtractionContext): Promise<Extraction> {
    if (!this.client) throw new AssistantProviderError('claude', 'unavailable');

    const request: ExtractionRequest = {
      model: this.model,
      max_tokens: 4096,
      system: EXTRACTION_INSTRUCTIONS,
      messages: [{ role: 'user', content: textPrompt(ctx, text) }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: EXTRACTION_JSON_SCHEMA } },
      fallbacks: 'default',
    };

    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create(request, { headers: { 'anthropic-beta': FALLBACK_BETA } });
    } catch (err: unknown) {
      if (err instanceof Anthropic.RateLimitError) throw new AssistantProviderError('claude', 'rate_limited', 60);
      throw new AssistantProviderError('claude', 'unavailable');
    }

    // A refusal can carry partial content: never read it.
    if (message.stop_reason === 'refusal') throw new AssistantProviderError('claude', 'rejected');
    if (message.stop_reason !== 'end_turn') throw new AssistantProviderError('claude', 'bad_output');

    const output = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');
    const parsed = ExtractionSchema.safeParse(parseJson(output));
    if (!parsed.success) throw new AssistantProviderError('claude', 'bad_output');
    return parsed.data;
  }
}
