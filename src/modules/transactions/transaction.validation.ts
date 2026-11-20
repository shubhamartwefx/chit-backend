import { z } from 'zod';

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(80).optional(),
  kind: z
    .enum(['invoice', 'installment', 'all'])
    .optional()
    .default('all'),
});

export type ListTransactionsQueryInput = z.infer<
  typeof listTransactionsQuerySchema
>;
