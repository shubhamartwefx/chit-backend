import { z } from 'zod';
import { PAYMENT_ROLES } from './signup-payment.model';

export const createOrderSchema = z.object({
  role: z.enum([PAYMENT_ROLES.AGENT, PAYMENT_ROLES.BIDDER]),
  sessionId: z.string().min(16).max(128),
});

export const confirmPaymentSchema = z.object({
  orderId: z.string().min(8).max(128),
  paymentId: z.string().min(4).max(128).optional(),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().min(8).max(128),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
