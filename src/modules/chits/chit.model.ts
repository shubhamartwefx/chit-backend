import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const CHIT_TYPES = {
  AGENT_CHIT: 'agent_chit',
  AUCTION_CHIT: 'auction_chit',
} as const;

export type ChitType = (typeof CHIT_TYPES)[keyof typeof CHIT_TYPES];

export const CHIT_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELETED: 'deleted',
} as const;

export type ChitStatus = (typeof CHIT_STATUS)[keyof typeof CHIT_STATUS];

export const BIDDER_REPORT_REASONS = {
  NOT_PAYING_PROPERLY: 'not_paying_properly',
  AMOUNT_TAKE_AND_RUNAWAY: 'amount_take_and_runaway',
  NOT_RESPONDING: 'not_responding',
  CHECK_BONES_TWICE: 'check_bones_twice',
} as const;

export type BidderReportReason =
  (typeof BIDDER_REPORT_REASONS)[keyof typeof BIDDER_REPORT_REASONS];

export interface IMemberReport {
  reason: BidderReportReason;
  note?: string | null;
  reportedBy: Types.ObjectId;
  createdAt: Date;
}

export interface IChitMember {
  bidderId: Types.ObjectId;
  numberOfTickets: number;
  joinedAt: Date;
  reports?: IMemberReport[];
}

export interface IChit {
  chitCode: string;
  type: ChitType;
  amountInLakhs: number;
  govtBettingAmount: number;
  monthlyInstallment: number;
  maxBidders: number;
  totalMonths: number;
  govtBettingUnits: number;
  startDate: Date;
  endDate: Date;
  completedMonths: number;
  status: ChitStatus;
  agentId?: Types.ObjectId | null;
  branchStoreId?: Types.ObjectId | null;
  members: IChitMember[];
  createdBy: Types.ObjectId;
}

export interface IChitDocument extends IChit, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const memberReportSchema = new Schema<IMemberReport>(
  {
    reason: {
      type: String,
      enum: Object.values(BIDDER_REPORT_REASONS),
      required: true,
    },
    note: { type: String, default: null, maxlength: 500 },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const chitMemberSchema = new Schema<IChitMember>(
  {
    bidderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    numberOfTickets: { type: Number, required: true, min: 1, max: 5, default: 1 },
    joinedAt: { type: Date, required: true, default: Date.now },
    reports: { type: [memberReportSchema], default: [] },
  },
  { _id: false }
);

const chitSchema = new Schema<IChitDocument>(
  {
    chitCode: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: Object.values(CHIT_TYPES),
      required: true,
    },
    amountInLakhs: { type: Number, required: true, min: 0.1 },
    govtBettingAmount: { type: Number, required: true, min: 0 },
    monthlyInstallment: { type: Number, required: true, min: 0 },
    maxBidders: { type: Number, required: true, min: 1 },
    totalMonths: { type: Number, required: true, min: 1 },
    govtBettingUnits: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    completedMonths: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(CHIT_STATUS),
      required: true,
      default: CHIT_STATUS.ACTIVE,
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    branchStoreId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    members: { type: [chitMemberSchema], default: [] },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

chitSchema.index({ chitCode: 1 }, { unique: true });
chitSchema.index({ agentId: 1, status: 1 });
chitSchema.index({ branchStoreId: 1, status: 1 });
chitSchema.index({ amountInLakhs: 1, status: 1 });

export const Chit: Model<IChitDocument> =
  mongoose.models.Chit || mongoose.model<IChitDocument>('Chit', chitSchema);
