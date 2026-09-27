import { z } from 'zod';
import {
  SUBSCRIPTION_BILLING_PERIODS,
  SUBSCRIPTION_PLAN_AUDIENCES,
} from './subscription-plan.model';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

const audienceSchema = z.enum([
  SUBSCRIPTION_PLAN_AUDIENCES.AGENT,
  SUBSCRIPTION_PLAN_AUDIENCES.BRANCH,
  SUBSCRIPTION_PLAN_AUDIENCES.BIDDER,
]);

const planInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(300),
  price: z.coerce.number().min(0),
  billingPeriod: z
    .enum([
      SUBSCRIPTION_BILLING_PERIODS.YEAR,
      SUBSCRIPTION_BILLING_PERIODS.MONTH,
    ])
    .optional()
    .default(SUBSCRIPTION_BILLING_PERIODS.YEAR),
  features: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
  icon: z.string().trim().min(1).max(80),
  bgClass: z.string().trim().min(1).max(120),
  colorClass: z.string().trim().min(1).max(80),
  btnType: z.enum(['a', 'link']).optional().default('a'),
  btnClass: z.string().trim().min(1).max(200),
  cardBorder: z.string().trim().max(120).optional().nullable(),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const createSubscriptionPlanSchema = planInputSchema.extend({
  audience: audienceSchema.optional().default(SUBSCRIPTION_PLAN_AUDIENCES.AGENT),
});

export type CreateSubscriptionPlanInput = z.infer<
  typeof createSubscriptionPlanSchema
>;

export const updateSubscriptionPlanSchema = planInputSchema.partial().extend({
  audience: audienceSchema.optional(),
});

export type UpdateSubscriptionPlanInput = z.infer<
  typeof updateSubscriptionPlanSchema
>;

export const bulkUpsertSubscriptionPlansSchema = z.object({
  audience: audienceSchema.default(SUBSCRIPTION_PLAN_AUDIENCES.AGENT),
  plans: z.array(planInputSchema).min(1).max(50),
});

export type BulkUpsertSubscriptionPlansInput = z.infer<
  typeof bulkUpsertSubscriptionPlansSchema
>;

export const listSubscriptionPlansQuerySchema = z.object({
  audience: audienceSchema.optional().default(SUBSCRIPTION_PLAN_AUDIENCES.AGENT),
});

export type ListSubscriptionPlansQueryInput = z.infer<
  typeof listSubscriptionPlansQuerySchema
>;

export const subscriptionPlanIdParamsSchema = z.object({
  id: objectIdSchema,
});
