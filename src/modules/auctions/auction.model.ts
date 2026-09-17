import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const AUCTION_ROUND_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

export type AuctionRoundStatus =
  (typeof AUCTION_ROUND_STATUS)[keyof typeof AUCTION_ROUND_STATUS];

export interface IAuctionBid {
  bidderId: Types.ObjectId;
  amount: number;
  placedAt: Date;
}

export interface IAuctionRound {
  chitId: Types.ObjectId;
  roundNumber: number;
  monthNumber: number;
  status: AuctionRoundStatus;
  opensAt: Date;
  closesAt: Date;
  winnerBidderId?: Types.ObjectId | null;
  winningBidAmount?: number | null;
  bids: IAuctionBid[];
  createdBy: Types.ObjectId;
}

export interface IAuctionRoundDocument extends IAuctionRound, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const auctionBidSchema = new Schema<IAuctionBid>(
  {
    bidderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    placedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const auctionRoundSchema = new Schema<IAuctionRoundDocument>(
  {
    chitId: {
      type: Schema.Types.ObjectId,
      ref: 'Chit',
      required: true,
      index: true,
    },
    roundNumber: { type: Number, required: true, min: 1 },
    monthNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: Object.values(AUCTION_ROUND_STATUS),
      required: true,
      default: AUCTION_ROUND_STATUS.OPEN,
      index: true,
    },
    opensAt: { type: Date, required: true },
    closesAt: { type: Date, required: true },
    winnerBidderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    winningBidAmount: { type: Number, default: null, min: 0 },
    bids: { type: [auctionBidSchema], default: [] },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

auctionRoundSchema.index({ chitId: 1, roundNumber: 1 }, { unique: true });

export const AuctionRound: Model<IAuctionRoundDocument> =
  mongoose.models.AuctionRound ||
  mongoose.model<IAuctionRoundDocument>('AuctionRound', auctionRoundSchema);
