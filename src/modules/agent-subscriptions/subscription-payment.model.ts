import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { PAYMENT_ORDER_STATUS, PaymentOrderStatus } from '../signup-payment/signup-payment.model';
import {
  AGENT_SUBSCRIPTION_KINDS,
  AgentSubscriptionKind,
} from './agent-subscription.model';

export interface ISubscriptionPaymentOrder {
  orderId: string;
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  kind: AgentSubscriptionKind;
  upgradeFromSubscriptionId?: Types.ObjectId | null;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  paymentId?: string | null;
  expiresAt: Date;
}

export interface ISubscriptionPaymentOrderDocument
  extends ISubscriptionPaymentOrder,
    Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPaymentOrderSchema = new Schema<ISubscriptionPaymentOrderDocument>(
  {
    orderId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    kind: {
      type: String,
      enum: Object.values(AGENT_SUBSCRIPTION_KINDS),
      required: true,
    },
    upgradeFromSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'AgentSubscription',
      default: null,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_ORDER_STATUS),
      default: PAYMENT_ORDER_STATUS.CREATED,
    },
    paymentId: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

subscriptionPaymentOrderSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const SubscriptionPaymentOrder: Model<ISubscriptionPaymentOrderDocument> =
  mongoose.models.SubscriptionPaymentOrder ||
  mongoose.model<ISubscriptionPaymentOrderDocument>(
    'SubscriptionPaymentOrder',
    subscriptionPaymentOrderSchema
  );
