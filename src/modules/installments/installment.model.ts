import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const INSTALLMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  WAIVED: 'waived',
} as const;

export type InstallmentStatus =
  (typeof INSTALLMENT_STATUS)[keyof typeof INSTALLMENT_STATUS];

export const INSTALLMENT_KIND = {
  BIDDER_PAYMENT: 'bidder_payment',
  AGENT_TAKEN: 'agent_taken',
  MONTH_SKIP: 'month_skip',
} as const;

export type InstallmentKind =
  (typeof INSTALLMENT_KIND)[keyof typeof INSTALLMENT_KIND];

export interface IInstallment {
  chitId: Types.ObjectId;
  bidderId?: Types.ObjectId | null;
  monthNumber: number;
  amount: number;
  balanceAmount: number;
  status: InstallmentStatus;
  kind: InstallmentKind;
  paidAt?: Date | null;
  note?: string | null;
  skipReason?: string | null;
  recordedBy: Types.ObjectId;
}

export interface IInstallmentDocument extends IInstallment, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const installmentSchema = new Schema<IInstallmentDocument>(
  {
    chitId: {
      type: Schema.Types.ObjectId,
      ref: 'Chit',
      required: true,
      index: true,
    },
    bidderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true,
    },
    monthNumber: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    balanceAmount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(INSTALLMENT_STATUS),
      required: true,
      default: INSTALLMENT_STATUS.PAID,
    },
    kind: {
      type: String,
      enum: Object.values(INSTALLMENT_KIND),
      required: true,
      default: INSTALLMENT_KIND.BIDDER_PAYMENT,
    },
    paidAt: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 500, default: null },
    skipReason: { type: String, trim: true, maxlength: 200, default: null },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

/** One bidder payment / unpaid pending row per member per month. */
installmentSchema.index(
  { chitId: 1, bidderId: 1, monthNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { bidderId: { $type: 'objectId' } },
  }
);

/** One agent-taken or skip entry per chit month. */
installmentSchema.index(
  { chitId: 1, monthNumber: 1, kind: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: {
        $in: [INSTALLMENT_KIND.AGENT_TAKEN, INSTALLMENT_KIND.MONTH_SKIP],
      },
    },
  }
);

export const Installment: Model<IInstallmentDocument> =
  mongoose.models.Installment ||
  mongoose.model<IInstallmentDocument>('Installment', installmentSchema);
