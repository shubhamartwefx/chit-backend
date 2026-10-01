import crypto from 'crypto';
import { notFound } from '../../common/errors';
import { env } from '../../config/env';
import { USER_ROLES } from '../../config/roles';
import { invoiceService, toInvoiceDto } from '../invoices/invoice.service';
import {
  SUBSCRIPTION_BILLING_PERIODS,
  SUBSCRIPTION_PLAN_AUDIENCES,
  SUBSCRIPTION_PLAN_STATUS,
  SubscriptionPlan,
} from '../subscription-plans/subscription-plan.model';
import { User } from '../users/user.model';
import {
  AGENT_SUBSCRIPTION_STATUS,
  AgentSubscription,
  IAgentSubscriptionDocument,
} from './agent-subscription.model';
import { PurchaseAgentSubscriptionInput } from './agent-subscription.validation';

function addBillingPeriod(from: Date, billingPeriod: string): Date {
  const end = new Date(from);
  if (billingPeriod === SUBSCRIPTION_BILLING_PERIODS.MONTH) {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

function toSubscriptionDto(doc: IAgentSubscriptionDocument) {
  const now = Date.now();
  const status =
    doc.status === AGENT_SUBSCRIPTION_STATUS.ACTIVE && doc.endsAt.getTime() <= now
      ? AGENT_SUBSCRIPTION_STATUS.EXPIRED
      : doc.status;
  return {
    id: doc._id.toString(),
    planId: doc.planId.toString(),
    planTitle: doc.planTitle,
    planPrice: doc.planPrice,
    billingPeriod: doc.billingPeriod,
    startsAt: doc.startsAt.toISOString(),
    endsAt: doc.endsAt.toISOString(),
    status,
    orderId: doc.orderId,
    paymentId: doc.paymentId,
    invoiceId: doc.invoiceId ? doc.invoiceId.toString() : null,
    mode: env.PAYMENT_MODE,
  };
}

export class AgentSubscriptionService {
  /**
   * Demo checkout: the payment is confirmed immediately (PAYMENT_MODE=demo).
   * Buying while a plan is active queues the new period after the current one.
   */
  async purchase(userId: string, input: PurchaseAgentSubscriptionInput) {
    const [user, plan] = await Promise.all([
      User.findById(userId),
      SubscriptionPlan.findOne({
        _id: input.planId,
        audience: SUBSCRIPTION_PLAN_AUDIENCES.AGENT,
        status: SUBSCRIPTION_PLAN_STATUS.ACTIVE,
      }),
    ]);
    if (!user) throw notFound('User not found');
    if (!plan) throw notFound('Subscription plan not found');

    const now = new Date();
    const latest = await AgentSubscription.findOne({
      userId: user._id,
      status: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
      endsAt: { $gt: now },
    }).sort({ endsAt: -1 });

    const startsAt = latest ? latest.endsAt : now;
    const endsAt = addBillingPeriod(startsAt, plan.billingPeriod);
    const orderId = `order_demo_${crypto.randomBytes(12).toString('hex')}`;
    const paymentId = `pay_demo_${crypto.randomBytes(12).toString('hex')}`;

    const subscription = await AgentSubscription.create({
      userId: user._id,
      planId: plan._id,
      planTitle: plan.title,
      planPrice: plan.price,
      billingPeriod: plan.billingPeriod,
      startsAt,
      endsAt,
      status: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
      orderId,
      paymentId,
    });

    const invoice = await invoiceService.createSubscriptionInvoice({
      userId: user._id,
      role: USER_ROLES.AGENT,
      orderId,
      paymentId,
      planId: plan._id,
      planTitle: plan.title,
      billingPeriod: plan.billingPeriod,
      periodStart: startsAt,
      periodEnd: endsAt,
      amount: plan.price,
      issuedAt: now,
    });

    subscription.invoiceId = invoice._id;
    await subscription.save();

    return {
      subscription: toSubscriptionDto(subscription),
      invoice: toInvoiceDto(invoice, user),
    };
  }

  async getCurrent(userId: string) {
    const now = new Date();
    const subs = await AgentSubscription.find({
      userId,
      status: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
      endsAt: { $gt: now },
    }).sort({ startsAt: 1 });

    const current = subs.find((s) => s.startsAt.getTime() <= now.getTime()) ?? null;
    const upcoming = subs.filter((s) => s.startsAt.getTime() > now.getTime());

    return {
      current: current ? toSubscriptionDto(current) : null,
      upcoming: upcoming.map(toSubscriptionDto),
    };
  }
}

export const agentSubscriptionService = new AgentSubscriptionService();
