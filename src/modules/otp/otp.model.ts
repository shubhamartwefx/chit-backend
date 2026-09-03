import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { USER_ROLES, UserRole } from '../../config/roles';

export interface IOtpSession {
  phone: string;
  countryCode: string;
  aadhaarFingerprint: string;
  role: UserRole;
  userId: Types.ObjectId;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  consumed: boolean;
}

export interface IOtpSessionDocument extends IOtpSession, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const otpSessionSchema = new Schema<IOtpSessionDocument>(
  {
    phone: { type: String, required: true, index: true },
    countryCode: { type: String, required: true },
    aadhaarFingerprint: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

otpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpSession: Model<IOtpSessionDocument> =
  mongoose.models.OtpSession ||
  mongoose.model<IOtpSessionDocument>('OtpSession', otpSessionSchema);
