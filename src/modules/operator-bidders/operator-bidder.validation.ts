import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

export const createOperatorBidderSchema = z.object({
  name: z.string().min(2).max(120),
  countryCode: z.string().min(1).default('+91'),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\d+$/, 'Phone must contain digits only'),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
});

export type CreateOperatorBidderInput = z.infer<
  typeof createOperatorBidderSchema
>;

export const listOperatorBiddersQuerySchema = z.object({
  q: z.string().max(80).optional(),
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListOperatorBiddersQueryInput = z.infer<
  typeof listOperatorBiddersQuerySchema
>;

export const listOperatorReportsQuerySchema = z.object({
  q: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListOperatorReportsQueryInput = z.infer<
  typeof listOperatorReportsQuerySchema
>;

export const listOperatorAgentsQuerySchema = z.object({
  q: z.string().max(80).optional(),
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
});

export type ListOperatorAgentsQueryInput = z.infer<
  typeof listOperatorAgentsQuerySchema
>;

export const operatorBidderIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const operatorBidderStatusActionSchema = z.object({
  reason: z.string().min(5).max(500),
});

export type OperatorBidderStatusActionInput = z.infer<
  typeof operatorBidderStatusActionSchema
>;

export const updateOperatorBidderSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export type UpdateOperatorBidderInput = z.infer<
  typeof updateOperatorBidderSchema
>;
