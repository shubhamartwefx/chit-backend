import crypto from 'crypto';
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IRefreshSession {
  sid: string;
  familyId: string;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedBySid?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  userAgentHash?: string | null;
}

export interface IRefreshSessionDocument extends IRefreshSession, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const refreshSessionSchema = new Schema<IRefreshSessionDocument>(
  {
    sid: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBySid: { type: String, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    userAgentHash: { type: String, default: null },
  },
  { timestamps: true }
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession: Model<IRefreshSessionDocument> =
  mongoose.models.RefreshSession ||
  mongoose.model<IRefreshSessionDocument>(
    'RefreshSession',
    refreshSessionSchema
  );

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  return crypto.createHash('sha256').update(userAgent).digest('hex');
}
