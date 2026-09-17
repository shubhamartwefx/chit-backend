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

export interface IWebAuthnCredential {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  createdAt: Date;
}

export interface INomineeLink {
  userId: Types.ObjectId;
  linkedAt: Date;
}

export interface IUser {
  name: string;
  countryCode: string;
  phone: string;
  phone2?: string | null;
  aadhaarFingerprint: string;
  role: UserRole;
  permissions: string[];
  status: UserStatus;
  statusReason?: string | null;
  statusChangedAt?: Date | null;
  statusChangedBy?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  lastLoginAt?: Date | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  aadhaarAddress?: IAadhaarAddress | null;
  currentAddress?: IAadhaarAddress | null;
  aadhaarLast4?: string | null;
  aadhaarVerifiedAt?: Date | null;
  verificationMethod?: VerificationMethod | null;
  nominees?: INomineeLink[];
  totpSecret?: string | null;
  totpPendingSecret?: string | null;
  totpEnabled?: boolean;
  totpVerifiedAt?: Date | null;
  pinHash?: string | null;
  screenLockEnabled?: boolean;
  biometricEnabled?: boolean;
  webauthnCredentials?: IWebAuthnCredential[];
  webauthnChallenge?: string | null;
  webauthnChallengeExpiresAt?: Date | null;
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

const webauthnCredentialSchema = new Schema<IWebAuthnCredential>(
  {
    credentialId: { type: String, required: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, required: true, default: 0 },
    transports: { type: [String], default: undefined },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const nomineeLinkSchema = new Schema<INomineeLink>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    linkedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const userSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, default: '+91' },
    phone: { type: String, required: true, trim: true, index: true },
    phone2: { type: String, default: null, trim: true },
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
    statusReason: { type: String, default: null, trim: true },
    statusChangedAt: { type: Date, default: null },
    statusChangedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastLoginAt: { type: Date, default: null },
    gender: { type: String, default: null, trim: true },
    dateOfBirth: { type: String, default: null, trim: true },
    aadhaarAddress: { type: aadhaarAddressSchema, default: null },
    currentAddress: { type: aadhaarAddressSchema, default: null },
    aadhaarLast4: { type: String, default: null, trim: true },    aadhaarVerifiedAt: { type: Date, default: null },
    verificationMethod: {
      type: String,
      enum: Object.values(VERIFICATION_METHODS),
      default: undefined,
    },
    nominees: { type: [nomineeLinkSchema], default: [] },
    totpSecret: { type: String, default: null, select: false },
    totpPendingSecret: { type: String, default: null, select: false },
    totpEnabled: { type: Boolean, default: false },
    totpVerifiedAt: { type: Date, default: null },
    pinHash: { type: String, default: null, select: false },
    screenLockEnabled: { type: Boolean, default: false },
    biometricEnabled: { type: Boolean, default: false },
    webauthnCredentials: { type: [webauthnCredentialSchema], default: [] },
    webauthnChallenge: { type: String, default: null, select: false },
    webauthnChallengeExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.index({ phone: 1, role: 1 }, { unique: true });
userSchema.index({ aadhaarFingerprint: 1, role: 1 }, { unique: true });

export const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', userSchema);
