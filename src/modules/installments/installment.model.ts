import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const INSTALLMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  WAIVED: 'waived',
} as const;

export type InstallmentStatus =
  (typeof INSTALLMENT_STATUS)[keyof typeof INSTALLMENT_STATUS];

export interface IInstallment {
  chitId: Types.ObjectId;
  bidderId: Types.ObjectId;
  monthNumber: number;
  amount: number;
  status: InstallmentStatus;
  paidAt?: Date | null;
  note?: string | null;
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
      required: true,
      index: true,
    },
    monthNumber: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(INSTALLMENT_STATUS),
      required: true,
      default: INSTALLMENT_STATUS.PAID,
    },
    paidAt: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 500, default: null },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

installmentSchema.index(
  { chitId: 1, bidderId: 1, monthNumber: 1 },
  { unique: true }
);

export const Installment: Model<IInstallmentDocument> =
  mongoose.models.Installment ||
  mongoose.model<IInstallmentDocument>('Installment', installmentSchema);
