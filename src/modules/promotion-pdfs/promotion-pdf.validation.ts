import { z } from 'zod';
import { CHIT_TYPES } from '../chits/chit.model';
import { PROMOTION_PDF_PAYMENT_TYPES } from './promotion-pdf.model';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

const chitTypeSchema = z.enum([
  CHIT_TYPES.AGENT_CHIT,
  CHIT_TYPES.AUCTION_CHIT,
]);

const paymentTypeSchema = z.enum([
  PROMOTION_PDF_PAYMENT_TYPES.CASH,
  PROMOTION_PDF_PAYMENT_TYPES.GPAY_PHONEPAY,
  PROMOTION_PDF_PAYMENT_TYPES.CASH_ONLY,
]);

export const createPromotionPdfSchema = z.object({
  type: chitTypeSchema,
  amountInLakhs: z.coerce.number().positive().max(1000),
  placeAndTime: z.string().trim().min(1).max(200),
  govtBettingAmount: z.coerce.number().min(0),
  monthlyInstallment: z.coerce.number().min(0),
  numberOfBidders: z.coerce.number().int().min(1).max(500),
  totalMonths: z.coerce.number().int().min(1).max(240),
  govtBettingUnits: z.coerce.number().int().min(0).max(100),
  paymentType: paymentTypeSchema,
  startDate: z.coerce.date(),
  lastDayToPay: z.coerce.date(),
});

export type CreatePromotionPdfInput = z.infer<typeof createPromotionPdfSchema>;

export const updatePromotionPdfSchema = createPromotionPdfSchema.partial();

export type UpdatePromotionPdfInput = z.infer<typeof updatePromotionPdfSchema>;

export const promotionPdfIdParamsSchema = z.object({
  id: objectIdSchema,
});

export type PromotionPdfIdParams = z.infer<typeof promotionPdfIdParamsSchema>;

export const listPromotionPdfsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  q: z.string().trim().optional(),
});

export type ListPromotionPdfsQueryInput = z.infer<
  typeof listPromotionPdfsQuerySchema
>;
