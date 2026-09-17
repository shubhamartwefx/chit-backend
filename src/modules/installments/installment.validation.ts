import { z } from 'zod';
import { INSTALLMENT_STATUS } from './installment.model';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

export const createInstallmentSchema = z.object({
  bidderId: objectIdSchema,
  monthNumber: z.coerce.number().int().min(1).max(240),
  amount: z.coerce.number().min(0).optional(),
  status: z
    .enum([
      INSTALLMENT_STATUS.PENDING,
      INSTALLMENT_STATUS.PAID,
      INSTALLMENT_STATUS.OVERDUE,
      INSTALLMENT_STATUS.WAIVED,
    ])
    .default(INSTALLMENT_STATUS.PAID),
  paidAt: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
});

export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;

export const listInstallmentsQuerySchema = z.object({
  bidderId: objectIdSchema.optional(),
  monthNumber: z.coerce.number().int().min(1).optional(),
  status: z
    .enum([
      INSTALLMENT_STATUS.PENDING,
      INSTALLMENT_STATUS.PAID,
      INSTALLMENT_STATUS.OVERDUE,
      INSTALLMENT_STATUS.WAIVED,
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListInstallmentsQueryInput = z.infer<
  typeof listInstallmentsQuerySchema
>;

export const chitIdParamsSchema = z.object({
  id: objectIdSchema,
});
