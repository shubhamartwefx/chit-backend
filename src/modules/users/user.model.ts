import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import {
  USER_ROLES,
  USER_STATUS,
  UserRole,
  UserStatus,
} from '../../config/roles';

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
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

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
