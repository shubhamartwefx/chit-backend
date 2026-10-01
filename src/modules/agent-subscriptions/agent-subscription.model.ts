import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const AGENT_SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
} as const;

export type AgentSubscriptionStatus =
  (typeof AGENT_SUBSCRIPTION_STATUS)[keyof typeof AGENT_SUBSCRIPTION_STATUS];

export interface IAgentSubscription {
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  planTitle: string;
  planPrice: number;
  billingPeriod: string;
  startsAt: Date;
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

export const AgentSubscription: Model<IAgentSubscriptionDocument> =
  mongoose.models.AgentSubscription ||
  mongoose.model<IAgentSubscriptionDocument>(
    'AgentSubscription',
    agentSubscriptionSchema
  );
