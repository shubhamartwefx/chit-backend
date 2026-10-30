import { z } from 'zod';
import { AGENT_REPORT_REASONS } from './agent-report.model';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

export const chitIdParamsSchema = z.object({
  id: objectIdSchema,
});

export type ChitIdParams = z.infer<typeof chitIdParamsSchema>;

export const agentReportIdParamsSchema = z.object({
  reportId: objectIdSchema,
});

export type AgentReportIdParams = z.infer<typeof agentReportIdParamsSchema>;

export const reportAgentSchema = z.object({
  reason: z.enum([
    AGENT_REPORT_REASONS.NOT_SETTLING_PAYMENTS,
    AGENT_REPORT_REASONS.AMOUNT_TAKE_AND_RUNAWAY,
    AGENT_REPORT_REASONS.NOT_RESPONDING,
    AGENT_REPORT_REASONS.MISMANAGING_CHIT,
  ]),
  note: z.string().trim().max(500).optional(),
});

export type ReportAgentInput = z.infer<typeof reportAgentSchema>;

export const updateAgentReportSchema = reportAgentSchema;

export type UpdateAgentReportInput = z.infer<typeof updateAgentReportSchema>;

export const listAgentReportsQuerySchema = z.object({
  q: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListAgentReportsQueryInput = z.infer<
  typeof listAgentReportsQuerySchema
>;
