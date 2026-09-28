import { z } from 'zod';

/**
 * What every extractor (Gemini, Claude) must return. The model output is untrusted: amounts are
 * re-validated and converted to tiyin, and names are matched to the user's own categories and
 * accounts on the server — ids never come from the model.
 */
export const ExtractedEntrySchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  /** So'm as a plain decimal string, e.g. "20000" or "12500.50". */
  amount: z.string(),
  note: z.string(),
  /** Exact name from the provided category list, or "" when none fits. */
  category: z.string(),
  /** Exact name from the provided account list, or "" when not mentioned. */
  account: z.string(),
  daysAgo: z.number().int(),
});
export type ExtractedEntry = z.infer<typeof ExtractedEntrySchema>;

export const ExtractionSchema = z.object({
  /** Verbatim transcript for voice; the input text for text requests. */
  transcript: z.string(),
  entries: z.array(ExtractedEntrySchema),
  /** The user talked about lending/borrowing, which is recorded in the Debts section instead. */
  debtMentioned: z.boolean(),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const entryProperties = {
  type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
  amount: { type: 'string', description: 'Amount in so‘m, digits with an optional . and up to 2 decimals' },
  note: { type: 'string', description: 'Short description in the language the user spoke' },
  category: { type: 'string', description: 'Exact category name from the list, or empty string' },
  account: { type: 'string', description: 'Exact account name from the list, or empty string' },
  daysAgo: { type: 'integer', description: '0 = today, 1 = yesterday' },
} as const;

/** Standard JSON Schema (Claude structured outputs require additionalProperties: false). */
export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    transcript: { type: 'string' },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: entryProperties,
        required: Object.keys(entryProperties),
        additionalProperties: false,
      },
    },
    debtMentioned: { type: 'boolean' },
  },
  required: ['transcript', 'entries', 'debtMentioned'],
  additionalProperties: false,
} as const;

type JsonSchemaNode = {
  type: string;
  description?: string;
  enum?: readonly string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: readonly string[];
  items?: JsonSchemaNode;
  additionalProperties?: boolean;
};

/**
 * Gemini's `responseSchema` is an OpenAPI subset: upper-case type names, no
 * additionalProperties, and propertyOrdering to keep the transcript first.
 */
export function toGeminiSchema(node: JsonSchemaNode): Record<string, unknown> {
  const out: Record<string, unknown> = { type: node.type.toUpperCase() };
  if (node.description) out.description = node.description;
  if (node.enum) out.enum = [...node.enum];
  if (node.properties) {
    out.properties = Object.fromEntries(
      Object.entries(node.properties).map(([key, child]) => [key, toGeminiSchema(child)]),
    );
    out.propertyOrdering = Object.keys(node.properties);
  }
  if (node.required) out.required = [...node.required];
  if (node.items) out.items = toGeminiSchema(node.items);
  return out;
}

export const GEMINI_EXTRACTION_SCHEMA = toGeminiSchema(EXTRACTION_JSON_SCHEMA as unknown as JsonSchemaNode);
