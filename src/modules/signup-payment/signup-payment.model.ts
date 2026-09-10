import mongoose, { Document, Model, Schema } from 'mongoose';

export const PAYMENT_ROLES = {
  AGENT: 'agent',
  BIDDER: 'bidder',
} as const;

export type PaymentRole = (typeof PAYMENT_ROLES)[keyof typeof PAYMENT_ROLES];

export const PAYMENT_ORDER_STATUS = {
  CREATED: 'created',
  PAID: 'paid',
  EXPIRED: 'expired',
  USED: 'used',
} as const;

export type PaymentOrderStatus =
  (typeof PAYMENT_ORDER_STATUS)[keyof typeof PAYMENT_ORDER_STATUS];

export interface ISignupPaymentOrder {
  orderId: string;
  role: PaymentRole;
  sessionId: string;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  paymentId?: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISignupPaymentOrderDocument
  extends ISignupPaymentOrder,
    Document {}

const signupPaymentOrderSchema = new Schema<ISignupPaymentOrderDocument>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    role: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_ROLES),
      index: true,
    },
    sessionId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_ORDER_STATUS),
      default: PAYMENT_ORDER_STATUS.CREATED,
      index: true,
    },
    paymentId: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

signupPaymentOrderSchema.index({ sessionId: 1, role: 1, status: 1 });

export const SignupPaymentOrder: Model<ISignupPaymentOrderDocument> =
  mongoose.models.SignupPaymentOrder ||
  mongoose.model<ISignupPaymentOrderDocument>(
    'SignupPaymentOrder',
    signupPaymentOrderSchema
  );
