import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const REVEAL_OUTCOMES = {
  REVEALED: 'revealed',
  NOT_ON_FILE: 'not_on_file',
  DENIED: 'denied',
} as const;

export type RevealOutcome =
  (typeof REVEAL_OUTCOMES)[keyof typeof REVEAL_OUTCOMES];

/** Audit trail of reveal attempts. Never stores the revealed value itself. */
export interface ISensitiveDataAccessLog {
  actorId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  field: string;
  outcome: RevealOutcome;
  ip: string | null;
  userAgent: string | null;
}

export interface ISensitiveDataAccessLogDocument
  extends ISensitiveDataAccessLog,
    Document {
  _id: Types.ObjectId;
  createdAt: Date;
}

export const USER_AGENT_MAX_LENGTH = 300;

const sensitiveDataAccessLogSchema =
  new Schema<ISensitiveDataAccessLogDocument>(
    {
      actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      targetUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      field: { type: String, required: true },
      outcome: {
        type: String,
        enum: Object.values(REVEAL_OUTCOMES),
        required: true,
      },
      ip: { type: String, default: null },
      userAgent: {
        type: String,
        default: null,
        maxlength: USER_AGENT_MAX_LENGTH,
      },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
  );

sensitiveDataAccessLogSchema.index({ targetUserId: 1, createdAt: -1 });
sensitiveDataAccessLogSchema.index({ actorId: 1, createdAt: -1 });

export const SensitiveDataAccessLog: Model<ISensitiveDataAccessLogDocument> =
  mongoose.models.SensitiveDataAccessLog ||
  mongoose.model<ISensitiveDataAccessLogDocument>(
    'SensitiveDataAccessLog',
    sensitiveDataAccessLogSchema
  );
