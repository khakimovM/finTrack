import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { GeminiClient, GeminiTask } from './providers/gemini.client';
import { AssistantProviderError } from './assistant.types';
import { RedisService } from '../../infra/redis/redis.service';

/** One import rarely has more unknown shops than this; the rest wait for the person. */
const MAX_MERCHANTS = 40;
const DAILY_CALLS_PER_USER = 30;

const INSTRUCTIONS = [
  'You sort merchants from bank card notifications in Uzbekistan into one person’s expense categories.',
  'A merchant is the name the payment terminal prints: Latin or Cyrillic, often with a legal form',
  '(OOO, MCHJ, LLC, XK, YATT, AO), abbreviated or cut off.',
  'For every numbered merchant answer exactly one category name copied from the list, or null when',
  'the name does not tell what was bought (a person’s name, a bank, a holding, a code).',
].join(' ');

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    results: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { n: { type: 'INTEGER' }, category: { type: 'STRING', nullable: true } },
        required: ['n', 'category'],
      },
    },
  },
  required: ['results'],
};

const AnswerSchema = z.object({
  results: z.array(z.object({ n: z.number().int(), category: z.string().nullable() })),
});

function task(merchants: string[], categories: string[]): GeminiTask<z.infer<typeof AnswerSchema>> {
  const prompt = [
    `Categories: ${JSON.stringify(categories)}`,
    'Merchants:',
    ...merchants.map((m, i) => `${i + 1}. ${m}`),
  ].join('\n');
  return {
    instructions: INSTRUCTIONS,
    parts: [{ text: prompt }],
    schema: SCHEMA,
    parse: (value) => {
      const parsed = AnswerSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
  };
}

/**
 * Names the category of shops the rules do not know. Only the shops' names leave the server: no
 * amounts, cards, dates or anything about the person.
 */
@Injectable()
export class MerchantClassifier {
  private readonly logger = new Logger(MerchantClassifier.name);

  constructor(
    private readonly gemini: GeminiClient,
    private readonly redis: RedisService,
  ) {}

  get enabled(): boolean {
    return this.gemini.enabled;
  }

  /** merchant → one of `categories`; a merchant the model could not place is left out. Never throws. */
  async classify(userId: string, merchants: string[], categories: string[]): Promise<Map<string, string>> {
    const placed = new Map<string, string>();
    const list = [...new Set(merchants)].slice(0, MAX_MERCHANTS);
    const names = [...new Set(categories)];
    if (!this.enabled || list.length === 0 || names.length === 0) return placed;

    const day = new Date().toISOString().slice(0, 10);
    const calls = await this.redis.incrWithTtl(`ai:merchants:${userId}:${day}`, 2 * 86_400);
    if (calls !== null && calls > DAILY_CALLS_PER_USER) return placed;

    try {
      const answer = await this.gemini.generate(task(list, names));
      for (const { n, category } of answer.results) {
        const merchant = list[n - 1];
        const name = category === null ? undefined : names.find((c) => c === category.trim());
        if (merchant && name) placed.set(merchant, name);
      }
    } catch (err) {
      if (!(err instanceof AssistantProviderError)) throw err;
      this.logger.warn(`Merchant categories unavailable: gemini ${err.reason}`);
    }
    return placed;
  }
}
