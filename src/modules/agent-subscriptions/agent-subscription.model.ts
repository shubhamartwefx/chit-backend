import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const AGENT_SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  UPGRADED: 'upgraded',
} as const;

export type AgentSubscriptionStatus =
  (typeof AGENT_SUBSCRIPTION_STATUS)[keyof typeof AGENT_SUBSCRIPTION_STATUS];

export const AGENT_SUBSCRIPTION_KINDS = {
  NEW: 'new',
  UPGRADE: 'upgrade',
} as const;

export type AgentSubscriptionKind =
  (typeof AGENT_SUBSCRIPTION_KINDS)[keyof typeof AGENT_SUBSCRIPTION_KINDS];

export interface IAgentSubscription {
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  planTitle: string;
  /** Full catalogue price of the plan at purchase time. */
  planPrice: number;
  /** What the agent actually paid (the price difference for upgrades). */
  amountPaid: number;
  kind: AgentSubscriptionKind;
  upgradedFromSubscriptionId?: Types.ObjectId | null;
  upgradedFromPlanTitle?: string | null;
  totalChits: number;
  features: string[];
  billingPeriod: string;
  /** Purchase date. */
  startsAt: Date;
  /** Expiry date (validity + grace for new plans; inherited on upgrade). */
  endsAt: Date;
  status: AgentSubscriptionStatus;
  orderId: string;
  paymentId: string;
  invoiceId?: Types.ObjectId | null;
}

export interface IAgentSubscriptionDocument extends IAgentSubscription, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const agentSubscriptionSchema = new Schema<IAgentSubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    planTitle: { type: String, required: true },
    planPrice: { type: Number, required: true },
    amountPaid: { type: Number, required: true },
    kind: {
      type: String,
      enum: Object.values(AGENT_SUBSCRIPTION_KINDS),
      required: true,
      default: AGENT_SUBSCRIPTION_KINDS.NEW,
    },
    upgradedFromSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'AgentSubscription',
      default: null,
    },
    upgradedFromPlanTitle: { type: String, default: null },
    totalChits: { type: Number, required: true, min: 0, default: 0 },
    features: { type: [String], default: [] },
    billingPeriod: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(AGENT_SUBSCRIPTION_STATUS),
      required: true,
      default: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
    },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
  },
  { timestamps: true }
);

agentSubscriptionSchema.index({ userId: 1, endsAt: -1 });
agentSubscriptionSchema.index({ userId: 1, status: 1 });

export const AgentSubscription: Model<IAgentSubscriptionDocument> =
  mongoose.models.AgentSubscription ||
  mongoose.model<IAgentSubscriptionDocument>(
    'AgentSubscription',
    agentSubscriptionSchema
  );
