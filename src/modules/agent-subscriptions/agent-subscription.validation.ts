import { z } from 'zod';

export const purchaseAgentSubscriptionSchema = z
  .object({
    planId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId'),
  })
  .strict();

export type PurchaseAgentSubscriptionInput = z.infer<
  typeof purchaseAgentSubscriptionSchema
>;
