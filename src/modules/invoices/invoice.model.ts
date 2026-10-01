import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const INVOICE_TYPES = {
  SIGNUP_VERIFICATION: 'signup_verification',
  SUBSCRIPTION: 'subscription',
} as const;

export type InvoiceType = (typeof INVOICE_TYPES)[keyof typeof INVOICE_TYPES];

export const INVOICE_STATUS = {
  PAID: 'paid',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const INVOICE_SOURCES = {
  PAYMENT: 'payment',
  BACKFILL: 'backfill',
} as const;

export type InvoiceSource = (typeof INVOICE_SOURCES)[keyof typeof INVOICE_SOURCES];

export interface IInvoice {
  userId: Types.ObjectId;
  role: string;
  type: InvoiceType;
  invoiceNumber: string;
  orderNumber: string;
  paymentId?: string | null;
  verificationMethod?: string | null;
  planId?: Types.ObjectId | null;
  planTitle?: string | null;
  billingPeriod?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  source: InvoiceSource;
  issuedAt: Date;
}

export interface IInvoiceDocument extends IInvoice, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoiceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(INVOICE_TYPES),
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true, index: true },
    paymentId: { type: String, default: null },
    verificationMethod: { type: String, default: null },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
    planTitle: { type: String, default: null },
    billingPeriod: { type: String, default: null },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    subtotal: { type: Number, required: true },
    taxPercent: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      required: true,
      default: INVOICE_STATUS.PAID,
    },
    source: {
      type: String,
      enum: Object.values(INVOICE_SOURCES),
      required: true,
      default: INVOICE_SOURCES.PAYMENT,
    },
    issuedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

invoiceSchema.index({ userId: 1, issuedAt: -1 });
invoiceSchema.index(
  { userId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: INVOICE_TYPES.SIGNUP_VERIFICATION },
  }
);

export const Invoice: Model<IInvoiceDocument> =
  mongoose.models.Invoice ||
  mongoose.model<IInvoiceDocument>('Invoice', invoiceSchema);

interface IInvoiceCounter {
  key: string;
  seq: number;
}

const invoiceCounterSchema = new Schema<IInvoiceCounter & Document>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export const InvoiceCounter: Model<IInvoiceCounter & Document> =
  mongoose.models.InvoiceCounter ||
  mongoose.model<IInvoiceCounter & Document>('InvoiceCounter', invoiceCounterSchema);
