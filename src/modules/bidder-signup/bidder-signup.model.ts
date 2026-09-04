import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const SIGNUP_METHODS = {
  MANUAL: 'manual',
  DIGILOCKER: 'digilocker',
} as const;

export type SignupMethod =
  (typeof SIGNUP_METHODS)[keyof typeof SIGNUP_METHODS];

export const SIGNUP_STATUS = {
  PENDING_OTP: 'pending_otp',
  DIGILOCKER_PENDING: 'digilocker_pending',
  VERIFIED: 'verified',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
} as const;

export type SignupStatus =
  (typeof SIGNUP_STATUS)[keyof typeof SIGNUP_STATUS];

export interface IVerifiedAadhaarProfile {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  aadhaarAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  aadhaarLast4: string;
}

export interface IBidderSignupSession {
  sessionId: string;
  method: SignupMethod;
  status: SignupStatus;
  aadhaarFingerprint?: string | null;
  aadhaarLast4?: string | null;
  maskedPhone?: string | null;
  otpHash?: string | null;
  attempts: number;
  otpExpiresAt?: Date | null;
  digilockerState?: string | null;
  verifiedProfile?: IVerifiedAadhaarProfile | null;
  expiresAt: Date;
  completedUserId?: Types.ObjectId | null;
}

export interface IBidderSignupSessionDocument
  extends IBidderSignupSession,
    Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const verifiedProfileSchema = new Schema<IVerifiedAadhaarProfile>(
  {
    fullName: { type: String, required: true },
    gender: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    aadhaarAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, required: true },
    },
    aadhaarLast4: { type: String, required: true },
  },
  { _id: false }
);

const bidderSignupSessionSchema = new Schema<IBidderSignupSessionDocument>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    method: {
      type: String,
      enum: Object.values(SIGNUP_METHODS),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SIGNUP_STATUS),
      required: true,
      index: true,
    },
    aadhaarFingerprint: { type: String, default: null, index: true },
    aadhaarLast4: { type: String, default: null },
    maskedPhone: { type: String, default: null },
    otpHash: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    otpExpiresAt: { type: Date, default: null },
    digilockerState: { type: String, default: null, index: true },
    verifiedProfile: { type: verifiedProfileSchema, default: null },
    expiresAt: { type: Date, required: true },
    completedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

bidderSignupSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BidderSignupSession: Model<IBidderSignupSessionDocument> =
  mongoose.models.BidderSignupSession ||
  mongoose.model<IBidderSignupSessionDocument>(
    'BidderSignupSession',
    bidderSignupSessionSchema
  );
