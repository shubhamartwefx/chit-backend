import { z } from 'zod';
import { CHIT_STATUS, CHIT_TYPES } from './chit.model';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

const chitTypeSchema = z.enum([
  CHIT_TYPES.AGENT_CHIT,
  CHIT_TYPES.AUCTION_CHIT,
]);

const memberInputSchema = z.object({
  bidderId: objectIdSchema,
  numberOfTickets: z.coerce.number().int().min(1).max(100).default(1),
});

export const createChitSchema = z.object({
  type: chitTypeSchema,
  amountInLakhs: z.coerce.number().positive().max(1000),
  govtBettingAmount: z.coerce.number().min(0),
  monthlyInstallment: z.coerce.number().min(0),
  maxBidders: z.coerce.number().int().min(1).max(500),
  totalMonths: z.coerce.number().int().min(1).max(240),
  govtBettingUnits: z.coerce.number().int().min(0).max(100),
  startDate: z.coerce.date(),
  agentId: objectIdSchema.optional(),
  members: z.array(memberInputSchema).max(500).optional(),
  completedMonths: z.coerce.number().int().min(0).optional(),
  status: z
    .enum([CHIT_STATUS.ACTIVE, CHIT_STATUS.COMPLETED, CHIT_STATUS.CANCELLED])
    .optional(),
});

export type CreateChitInput = z.infer<typeof createChitSchema>;

export const updateChitSchema = z
  .object({
    type: chitTypeSchema.optional(),
    amountInLakhs: z.coerce.number().positive().max(1000).optional(),
    govtBettingAmount: z.coerce.number().min(0).optional(),
    monthlyInstallment: z.coerce.number().min(0).optional(),
    maxBidders: z.coerce.number().int().min(1).max(500).optional(),
    totalMonths: z.coerce.number().int().min(1).max(240).optional(),
    govtBettingUnits: z.coerce.number().int().min(0).max(100).optional(),
    startDate: z.coerce.date().optional(),
    members: z.array(memberInputSchema).max(500).optional(),
    completedMonths: z.coerce.number().int().min(0).optional(),
    status: z
      .enum([CHIT_STATUS.ACTIVE, CHIT_STATUS.COMPLETED, CHIT_STATUS.CANCELLED])
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateChitInput = z.infer<typeof updateChitSchema>;

export const listChitsQuerySchema = z.object({
  q: z.string().max(80).optional(),
  amountInLakhs: z.coerce.number().positive().optional(),
  status: z
    .enum([
      CHIT_STATUS.ACTIVE,
      CHIT_STATUS.COMPLETED,
      CHIT_STATUS.CANCELLED,
      CHIT_STATUS.DELETED,
    ])
    .optional(),
  agentId: objectIdSchema.optional(),
  includeDeleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListChitsQueryInput = z.infer<typeof listChitsQuerySchema>;

export const chitIdParamsSchema = z.object({
  id: objectIdSchema,
});

export type ChitIdParams = z.infer<typeof chitIdParamsSchema>;

export const summaryQuerySchema = z.object({
  agentId: objectIdSchema.optional(),
  includeDeleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type SummaryQueryInput = z.infer<typeof summaryQuerySchema>;
