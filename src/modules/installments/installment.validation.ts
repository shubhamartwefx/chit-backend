import { z } from 'zod';
import { INSTALLMENT_STATUS } from './installment.model';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

const statusSchema = z.enum([
  INSTALLMENT_STATUS.PENDING,
  INSTALLMENT_STATUS.PAID,
  INSTALLMENT_STATUS.OVERDUE,
  INSTALLMENT_STATUS.WAIVED,
]);

export const createInstallmentSchema = z.object({
  bidderId: objectIdSchema,
  monthNumber: z.coerce.number().int().min(1).max(240),
  amount: z.coerce.number().min(0).optional(),
  balanceAmount: z.coerce.number().min(0).optional(),
  status: statusSchema.default(INSTALLMENT_STATUS.PAID),
  paidAt: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
  unpaidBidderIds: z.array(objectIdSchema).max(100).optional(),
});

export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;

export const bidderPaymentMonthDetailSchema = createInstallmentSchema;

export type BidderPaymentMonthDetailInput = z.infer<
  typeof bidderPaymentMonthDetailSchema
>;

export const agentTakenMonthDetailSchema = z.object({
  monthNumber: z.coerce.number().int().min(1).max(240),
  amount: z.coerce.number().min(0).optional(),
  balanceAmount: z.coerce.number().min(0).optional(),
  paidAt: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
  unpaidBidderIds: z.array(objectIdSchema).max(100).optional(),
});

export type AgentTakenMonthDetailInput = z.infer<
  typeof agentTakenMonthDetailSchema
>;

export const skipMonthDetailSchema = z.object({
  monthNumber: z.coerce.number().int().min(1).max(240),
  skipReason: z.string().trim().min(1).max(200),
  amount: z.coerce.number().min(0).optional(),
  balanceAmount: z.coerce.number().min(0).optional(),
  skippedAt: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
});

export type SkipMonthDetailInput = z.infer<typeof skipMonthDetailSchema>;

export const updateInstallmentSchema = z
  .object({
    amount: z.coerce.number().min(0).optional(),
    balanceAmount: z.coerce.number().min(0).optional(),
    status: statusSchema.optional(),
    paidAt: z.coerce.date().nullable().optional(),
    note: z.string().max(500).nullable().optional(),
    skipReason: z.string().trim().max(200).nullable().optional(),
  })
  .refine(
    (body) =>
      body.amount !== undefined ||
      body.balanceAmount !== undefined ||
      body.status !== undefined ||
      body.paidAt !== undefined ||
      body.note !== undefined ||
      body.skipReason !== undefined,
    { message: 'At least one field is required' }
  );

export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;

export const listInstallmentsQuerySchema = z.object({
  bidderId: objectIdSchema.optional(),
  monthNumber: z.coerce.number().int().min(1).optional(),
  status: statusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListInstallmentsQueryInput = z.infer<
  typeof listInstallmentsQuerySchema
>;

export const chitIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const installmentParamsSchema = z.object({
  id: objectIdSchema,
  installmentId: objectIdSchema,
});
