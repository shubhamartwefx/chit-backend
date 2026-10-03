import { z } from 'zod';

export const createAgentSubscriptionOrderSchema = z
  .object({
    planId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId'),
  })
  .strict();

export type CreateAgentSubscriptionOrderInput = z.infer<
  typeof createAgentSubscriptionOrderSchema
>;

export const confirmAgentSubscriptionSchema = z
  .object({
    orderId: z.string().trim().min(8).max(128),
    paymentId: z.string().trim().min(4).max(128).optional(),
  })
  .strict();

export type ConfirmAgentSubscriptionInput = z.infer<
  typeof confirmAgentSubscriptionSchema
>;
