import { z } from 'zod';
import { isoDateSchema, noteSchema, positiveTiyinSchema } from './common';

export const CreateTransferInputSchema = z
  .object({
    fromAccountId: z.string().uuid('Yaroqsiz jo‘natuvchi hisob ID si'),
    toAccountId: z.string().uuid('Yaroqsiz qabul qiluvchi hisob ID si'),
    amount: positiveTiyinSchema,
    date: isoDateSchema,
    note: noteSchema.optional().nullable(),
  })
  .strict();
export type CreateTransferInput = z.infer<typeof CreateTransferInputSchema>;

export const TransferResponseSchema = z.object({
  transferGroupId: z.string(),
  out: z.object({
    id: z.string().uuid(),
    type: z.literal('TRANSFER_OUT'),
    accountId: z.string().uuid(),
    amount: z.string(),
  }),
  in: z.object({
    id: z.string().uuid(),
    type: z.literal('TRANSFER_IN'),
    accountId: z.string().uuid(),
    amount: z.string(),
  }),
  balances: z.record(z.string()),
});
export type TransferResponse = z.infer<typeof TransferResponseSchema>;
