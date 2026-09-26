import { z } from 'zod';

export const CreateTransferInputSchema = z.object({
  fromAccountId: z.string().uuid('Yaroqsiz jo‘natuvchi hisob ID si'),
  toAccountId: z.string().uuid('Yaroqsiz qabul qiluvchi hisob ID si'),
  amount: z.string().regex(/^[1-9]\d*$/, 'Summa 0 dan katta butun tiyin bo‘lishi kerak'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD formatida bo‘lishi kerak'),
  note: z.string().max(500, 'Izoh 500 belgidan oshmasligi kerak').optional().nullable(),
});
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
