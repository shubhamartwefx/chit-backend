import mongoose, { Document, Model, Schema, Types } from 'mongoose';

/** Unique bidders that must report an agent before the account is auto-blocked. */
export const AGENT_AUTO_BLOCK_UNIQUE_REPORTERS = 10;

export const AGENT_REPORT_REASONS = {
  NOT_SETTLING_PAYMENTS: 'not_settling_payments',
  AMOUNT_TAKE_AND_RUNAWAY: 'amount_take_and_runaway',
  NOT_RESPONDING: 'not_responding',
  MISMANAGING_CHIT: 'mismanaging_chit',
} as const;

export type AgentReportReason =
  (typeof AGENT_REPORT_REASONS)[keyof typeof AGENT_REPORT_REASONS];

export interface IAgentReport {
  agentId: Types.ObjectId;
  reporterId: Types.ObjectId;
  chitId: Types.ObjectId;
  reason: AgentReportReason;
  note?: string | null;
}

export interface IAgentReportDocument extends IAgentReport, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const agentReportSchema = new Schema<IAgentReportDocument>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chitId: {
      type: Schema.Types.ObjectId,
      ref: 'Chit',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: Object.values(AGENT_REPORT_REASONS),
      required: true,
    },
    note: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

/** Non-unique — bidders may file multiple reports per agent/chit. */
agentReportSchema.index({ agentId: 1, reporterId: 1, chitId: 1 });
agentReportSchema.index({ agentId: 1, createdAt: -1 });
agentReportSchema.index({ reporterId: 1, createdAt: -1 });

export const AgentReport: Model<IAgentReportDocument> =
  mongoose.models.AgentReport ||
  mongoose.model<IAgentReportDocument>('AgentReport', agentReportSchema);
