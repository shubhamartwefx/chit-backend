import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import {
  USER_ROLES,
  USER_STATUS,
  UserRole,
  UserStatus,
} from '../../config/roles';

export const VERIFICATION_METHODS = {
  MANUAL: 'manual',
  DIGILOCKER: 'digilocker',
  ADMIN_PROVISIONED: 'admin_provisioned',
} as const;

export type VerificationMethod =
  (typeof VERIFICATION_METHODS)[keyof typeof VERIFICATION_METHODS];

export interface IAadhaarAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IUser {
  name: string;
  countryCode: string;
  phone: string;
  aadhaarFingerprint: string;
  role: UserRole;
  permissions: string[];
  status: UserStatus;
  createdBy?: Types.ObjectId | null;
  lastLoginAt?: Date | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  aadhaarAddress?: IAadhaarAddress | null;
  currentAddress?: string | null;
  aadhaarLast4?: string | null;
  aadhaarVerifiedAt?: Date | null;
  verificationMethod?: VerificationMethod | null;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const aadhaarAddressSchema = new Schema<IAadhaarAddress>(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, default: '+91' },
    phone: { type: String, required: true, trim: true, index: true },
    aadhaarFingerprint: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
      index: true,
    },
    permissions: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastLoginAt: { type: Date, default: null },
    gender: { type: String, default: null, trim: true },
    dateOfBirth: { type: String, default: null, trim: true },
    aadhaarAddress: { type: aadhaarAddressSchema, default: null },
    currentAddress: { type: String, default: null, trim: true },
    aadhaarLast4: { type: String, default: null, trim: true },
    aadhaarVerifiedAt: { type: Date, default: null },
    verificationMethod: {
      type: String,
      enum: Object.values(VERIFICATION_METHODS),
      default: undefined,
    },
  },
  { timestamps: true }
);

userSchema.index({ phone: 1, role: 1 }, { unique: true });
userSchema.index(
  { aadhaarFingerprint: 1, role: 1 },
  { unique: true }
);

export const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', userSchema);
