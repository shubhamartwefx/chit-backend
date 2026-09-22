import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const SUBSCRIPTION_PLAN_AUDIENCES = {
  AGENT: 'agent',
  BRANCH: 'branch',
  BIDDER: 'bidder',
} as const;

export type SubscriptionPlanAudience =
  (typeof SUBSCRIPTION_PLAN_AUDIENCES)[keyof typeof SUBSCRIPTION_PLAN_AUDIENCES];

export const SUBSCRIPTION_PLAN_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
} as const;

export type SubscriptionPlanStatus =
  (typeof SUBSCRIPTION_PLAN_STATUS)[keyof typeof SUBSCRIPTION_PLAN_STATUS];

export const SUBSCRIPTION_BILLING_PERIODS = {
  YEAR: 'year',
  MONTH: 'month',
} as const;

export type SubscriptionBillingPeriod =
  (typeof SUBSCRIPTION_BILLING_PERIODS)[keyof typeof SUBSCRIPTION_BILLING_PERIODS];

export interface ISubscriptionPlan {
  audience: SubscriptionPlanAudience;
  title: string;
  subtitle: string;
  price: number;
  billingPeriod: SubscriptionBillingPeriod;
  features: string[];
  icon: string;
  bgClass: string;
  colorClass: string;
  btnType: 'a' | 'link';
  btnClass: string;
  cardBorder?: string | null;
  sortOrder: number;
  status: SubscriptionPlanStatus;
  createdBy: Types.ObjectId;
}

export interface ISubscriptionPlanDocument
  extends ISubscriptionPlan,
    Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlanDocument>(
  {
    audience: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLAN_AUDIENCES),
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, required: true, trim: true, maxlength: 300 },
    price: { type: Number, required: true, min: 0 },
    billingPeriod: {
      type: String,
      enum: Object.values(SUBSCRIPTION_BILLING_PERIODS),
      required: true,
      default: SUBSCRIPTION_BILLING_PERIODS.YEAR,
    },
    features: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'features must be a non-empty array',
      },
    },
    icon: { type: String, required: true, trim: true, maxlength: 80 },
    bgClass: { type: String, required: true, trim: true, maxlength: 120 },
    colorClass: { type: String, required: true, trim: true, maxlength: 80 },
    btnType: {
      type: String,
      enum: ['a', 'link'],
      required: true,
      default: 'a',
    },
    btnClass: { type: String, required: true, trim: true, maxlength: 200 },
    cardBorder: { type: String, default: null, maxlength: 120 },
    sortOrder: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLAN_STATUS),
      required: true,
      default: SUBSCRIPTION_PLAN_STATUS.ACTIVE,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ audience: 1, status: 1, sortOrder: 1 });

export const SubscriptionPlan: Model<ISubscriptionPlanDocument> =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<ISubscriptionPlanDocument>(
    'SubscriptionPlan',
    subscriptionPlanSchema
  );
