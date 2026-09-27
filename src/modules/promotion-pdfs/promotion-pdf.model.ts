import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { CHIT_TYPES, ChitType } from '../chits/chit.model';

export const PROMOTION_PDF_PAYMENT_TYPES = {
  CASH: 'cash',
  GPAY_PHONEPAY: 'gpay_phonepay',
  CASH_ONLY: 'cash_only',
} as const;

export type PromotionPdfPaymentType =
  (typeof PROMOTION_PDF_PAYMENT_TYPES)[keyof typeof PROMOTION_PDF_PAYMENT_TYPES];

export const PROMOTION_PDF_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
} as const;

export type PromotionPdfStatus =
  (typeof PROMOTION_PDF_STATUS)[keyof typeof PROMOTION_PDF_STATUS];

export const MAX_PROMOTION_PDFS_PER_AGENT = 10;

export interface IPromotionPdf {
  pdfCode: string;
  type: ChitType;
  amountInLakhs: number;
  placeAndTime: string;
  govtBettingAmount: number;
  monthlyInstallment: number;
  numberOfBidders: number;
  totalMonths: number;
  govtBettingUnits: number;
  paymentType: PromotionPdfPaymentType;
  startDate: Date;
  lastDayToPay: Date;
  agentId: Types.ObjectId;
  createdBy: Types.ObjectId;
  status: PromotionPdfStatus;
}

export interface IPromotionPdfDocument extends IPromotionPdf, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const promotionPdfSchema = new Schema<IPromotionPdfDocument>(
  {
    pdfCode: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: Object.values(CHIT_TYPES),
      required: true,
    },
    amountInLakhs: { type: Number, required: true, min: 0.01, max: 1000 },
    placeAndTime: { type: String, required: true, trim: true, maxlength: 200 },
    govtBettingAmount: { type: Number, required: true, min: 0 },
    monthlyInstallment: { type: Number, required: true, min: 0 },
    numberOfBidders: { type: Number, required: true, min: 1, max: 500 },
    totalMonths: { type: Number, required: true, min: 1, max: 240 },
    govtBettingUnits: { type: Number, required: true, min: 0, max: 100 },
    paymentType: {
      type: String,
      enum: Object.values(PROMOTION_PDF_PAYMENT_TYPES),
      required: true,
    },
    startDate: { type: Date, required: true },
    lastDayToPay: { type: Date, required: true },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PROMOTION_PDF_STATUS),
      required: true,
      default: PROMOTION_PDF_STATUS.ACTIVE,
      index: true,
    },
  },
  { timestamps: true }
);

promotionPdfSchema.index({ pdfCode: 1 }, { unique: true });
promotionPdfSchema.index({ agentId: 1, status: 1, createdAt: -1 });

export const PromotionPdf: Model<IPromotionPdfDocument> =
  mongoose.models.PromotionPdf ||
  mongoose.model<IPromotionPdfDocument>('PromotionPdf', promotionPdfSchema);

export { CHIT_TYPES };
