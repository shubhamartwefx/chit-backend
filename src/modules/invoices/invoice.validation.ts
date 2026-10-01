import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

export const listInvoicesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type ListInvoicesQueryInput = z.infer<typeof listInvoicesQuerySchema>;

export const invoiceIdParamsSchema = z.object({
  id: objectIdSchema,
});
