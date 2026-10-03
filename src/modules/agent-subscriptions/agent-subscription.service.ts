import crypto from 'crypto';
import { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../../common/errors';
import { API_MESSAGES } from '../../common/status';
import { env } from '../../config/env';
import { USER_ROLES } from '../../config/roles';
import { CHIT_STATUS, Chit } from '../chits/chit.model';
import { Invoice } from '../invoices/invoice.model';
import { invoiceService, toInvoiceDto } from '../invoices/invoice.service';
import { PAYMENT_ORDER_STATUS } from '../signup-payment/signup-payment.model';
import {
  ISubscriptionPlanDocument,
  SUBSCRIPTION_PLAN_AUDIENCES,
  SUBSCRIPTION_PLAN_STATUS,
  SubscriptionPlan,
} from '../subscription-plans/subscription-plan.model';
import { resolvePlanTotalChits } from '../subscription-plans/subscription-plan.service';
import { IUserDocument, User } from '../users/user.model';
import {
  AGENT_SUBSCRIPTION_KINDS,
  AGENT_SUBSCRIPTION_STATUS,
  AgentSubscription,
  IAgentSubscriptionDocument,
} from './agent-subscription.model';
import {
  ConfirmAgentSubscriptionInput,
  CreateAgentSubscriptionOrderInput,
} from './agent-subscription.validation';
import {
  ISubscriptionPaymentOrderDocument,
  SubscriptionPaymentOrder,
} from './subscription-payment.model';

const ORDER_TTL_MINUTES = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_BLOCK_REASONS = {
  REQUIRED: 'SUBSCRIPTION_REQUIRED',
  LIMIT_REACHED: 'SUBSCRIPTION_LIMIT_REACHED',
} as const;

export type UpgradeOption = {
  planId: string;
  planTitle: string;
  totalChits: number;
  price: number;
  upgradePrice: number;
};

function newOrderId(): string {
  return `order_sub_${crypto.randomBytes(12).toString('hex')}`;
}

function newPaymentId(): string {
  return `pay_demo_${crypto.randomBytes(12).toString('hex')}`;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

function totalValidityDays(): number {
  return env.SUBSCRIPTION_VALIDITY_DAYS + env.SUBSCRIPTION_GRACE_DAYS;
}

function daysUntil(date: Date, now = Date.now()): number {
  return Math.ceil((date.getTime() - now) / MS_PER_DAY);
}

function sameTitle(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function effectiveStatus(doc: IAgentSubscriptionDocument, now = Date.now()) {
  if (
    doc.status === AGENT_SUBSCRIPTION_STATUS.ACTIVE &&
    doc.endsAt.getTime() <= now
  ) {
    return AGENT_SUBSCRIPTION_STATUS.EXPIRED;
  }
  return doc.status;
}

function toSubscriptionDto(doc: IAgentSubscriptionDocument) {
  const now = Date.now();
  const status = effectiveStatus(doc, now);
  const daysRemaining = daysUntil(doc.endsAt, now);
  return {
    id: doc._id.toString(),
    orderId: doc.orderId,
    paymentId: doc.paymentId,
    planId: doc.planId.toString(),
    planTitle: doc.planTitle,
    price: doc.planPrice,
    amountPaid: doc.amountPaid ?? doc.planPrice,
    kind: doc.kind ?? AGENT_SUBSCRIPTION_KINDS.NEW,
    upgradedFromPlanTitle: doc.upgradedFromPlanTitle ?? null,
    totalChits: doc.totalChits ?? 0,
    features: doc.features ?? [],
    billingPeriod: doc.billingPeriod,
    purchaseDate: doc.startsAt.toISOString(),
    expiryDate: doc.endsAt.toISOString(),
    validityDays: Math.max(0, daysUntil(doc.endsAt, doc.startsAt.getTime())),
    daysRemaining,
    expiringSoon:
      status === AGENT_SUBSCRIPTION_STATUS.ACTIVE &&
      daysRemaining <= env.SUBSCRIPTION_EXPIRING_SOON_DAYS,
    status,
    invoiceId: doc.invoiceId ? doc.invoiceId.toString() : null,
    mode: env.PAYMENT_MODE,
  };
}

function toOrderDto(
  order: ISubscriptionPaymentOrderDocument,
  plan: ISubscriptionPlanDocument,
  source: IAgentSubscriptionDocument | null
) {
  const projectedExpiry = source
    ? source.endsAt
    : addDays(new Date(), totalValidityDays());
  return {
    orderId: order.orderId,
    kind: order.kind,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    expiresAt: order.expiresAt.toISOString(),
    keyId: 'demo',
    mode: env.PAYMENT_MODE,
    plan: {
      id: plan._id.toString(),
      title: plan.title,
      price: plan.price,
      totalChits: resolvePlanTotalChits(plan),
    },
    upgradeFrom: source
      ? {
          subscriptionId: source._id.toString(),
          planTitle: source.planTitle,
          planPrice: source.planPrice,
          totalChits: source.totalChits,
        }
      : null,
    expiryDate: projectedExpiry.toISOString(),
  };
}

async function loadAgentPlans(): Promise<ISubscriptionPlanDocument[]> {
  return SubscriptionPlan.find({
    audience: SUBSCRIPTION_PLAN_AUDIENCES.AGENT,
    status: SUBSCRIPTION_PLAN_STATUS.ACTIVE,
  }).sort({ sortOrder: 1, price: 1 });
}

/**
 * Plan ids change when super-admin bulk-saves the catalogue, so fall back to a
 * title match to keep the subscribed plan recognisable.
 */
function matchCatalogPlan(
  plans: ISubscriptionPlanDocument[],
  sub: IAgentSubscriptionDocument
): ISubscriptionPlanDocument | null {
  const subPlanId = sub.planId.toString();
  return (
    plans.find((p) => p._id.toString() === subPlanId) ??
    plans.find((p) => sameTitle(p.title, sub.planTitle)) ??
    null
  );
}

function isUpgradeTarget(
  plan: ISubscriptionPlanDocument,
  active: IAgentSubscriptionDocument
): boolean {
  return (
    plan.price > active.planPrice &&
    resolvePlanTotalChits(plan) > (active.totalChits ?? 0)
  );
}

function buildUpgradeOptions(
  plans: ISubscriptionPlanDocument[],
  active: IAgentSubscriptionDocument | null
): UpgradeOption[] {
  const candidates = active
    ? plans.filter((p) => {
        const matched = matchCatalogPlan(plans, active);
        if (matched && matched._id.equals(p._id)) return false;
        return isUpgradeTarget(p, active);
      })
    : plans.filter((p) => resolvePlanTotalChits(p) > 0);

  return candidates
    .map((p) => ({
      planId: p._id.toString(),
      planTitle: p.title,
      totalChits: resolvePlanTotalChits(p),
      price: p.price,
      upgradePrice: active ? p.price - active.planPrice : p.price,
    }))
    .sort((a, b) => a.upgradePrice - b.upgradePrice);
}

/**
 * Subscriptions bought before plan limits existed have no `totalChits`
 * snapshot; fill it (and the other snapshot fields) from their plan.
 */
async function backfillLegacy(userId: Types.ObjectId | string): Promise<void> {
  const legacy = await AgentSubscription.find({
    userId,
    $or: [{ totalChits: { $exists: false } }, { amountPaid: { $exists: false } }],
  }).lean();
  if (!legacy.length) return;

  const plans = await loadAgentPlans();
  for (const sub of legacy) {
    const plan =
      (await SubscriptionPlan.findById(sub.planId)) ??
      matchCatalogPlan(plans, sub as unknown as IAgentSubscriptionDocument);
    const set: Record<string, unknown> = {};
    if (sub.totalChits === undefined) {
      set.totalChits = plan ? resolvePlanTotalChits(plan) : 0;
      set.features = plan?.features ?? [];
    }
    if (sub.amountPaid === undefined) set.amountPaid = sub.planPrice;
    if (sub.kind === undefined) set.kind = AGENT_SUBSCRIPTION_KINDS.NEW;
    await AgentSubscription.updateOne({ _id: sub._id }, { $set: set });
  }
}

async function expireLapsed(userId: Types.ObjectId | string): Promise<void> {
  await backfillLegacy(userId);
  await AgentSubscription.updateMany(
    {
      userId,
      status: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
      endsAt: { $lte: new Date() },
    },
    { $set: { status: AGENT_SUBSCRIPTION_STATUS.EXPIRED } }
  );
}

async function findActive(
  userId: Types.ObjectId | string
): Promise<IAgentSubscriptionDocument | null> {
  await expireLapsed(userId);
  return AgentSubscription.findOne({
    userId,
    status: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
    startsAt: { $lte: new Date() },
  }).sort({ endsAt: -1 });
}

async function countActiveChits(agentId: Types.ObjectId | string): Promise<number> {
  return Chit.countDocuments({ agentId, status: CHIT_STATUS.ACTIVE });
}

async function loadAgent(userId: string): Promise<IUserDocument> {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  return user;
}

export class AgentSubscriptionService {
  async createOrder(userId: string, input: CreateAgentSubscriptionOrderInput) {
    const user = await loadAgent(userId);
    const plan = await SubscriptionPlan.findOne({
      _id: input.planId,
      audience: SUBSCRIPTION_PLAN_AUDIENCES.AGENT,
      status: SUBSCRIPTION_PLAN_STATUS.ACTIVE,
    });
    if (!plan) throw notFound('Subscription plan not found');

    const active = await findActive(user._id);
    let kind: (typeof AGENT_SUBSCRIPTION_KINDS)[keyof typeof AGENT_SUBSCRIPTION_KINDS] =
      AGENT_SUBSCRIPTION_KINDS.NEW;
    let amount = plan.price;

    if (active) {
      const plans = await loadAgentPlans();
      const matched = matchCatalogPlan(plans, active);
      if (matched && matched._id.equals(plan._id)) {
        throw conflict(API_MESSAGES.SUBSCRIPTION_ALREADY_SUBSCRIBED);
      }
      if (!isUpgradeTarget(plan, active)) {
        throw badRequest(API_MESSAGES.SUBSCRIPTION_DOWNGRADE_BLOCKED);
      }
      kind = AGENT_SUBSCRIPTION_KINDS.UPGRADE;
      amount = plan.price - active.planPrice;
    }

    const pending = await SubscriptionPaymentOrder.findOne({
      userId: user._id,
      planId: plan._id,
      kind,
      upgradeFromSubscriptionId: active ? active._id : null,
      amount,
      status: PAYMENT_ORDER_STATUS.CREATED,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    const order =
      pending ??
      (await SubscriptionPaymentOrder.create({
        orderId: newOrderId(),
        userId: user._id,
        planId: plan._id,
        kind,
        upgradeFromSubscriptionId: active ? active._id : null,
        amount,
        currency: 'INR',
        status: PAYMENT_ORDER_STATUS.CREATED,
        expiresAt: new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000),
      }));

    return toOrderDto(order, plan, active);
  }

  async confirm(userId: string, input: ConfirmAgentSubscriptionInput) {
    const user = await loadAgent(userId);
    const order = await SubscriptionPaymentOrder.findOne({ orderId: input.orderId });
    if (!order || !order.userId.equals(user._id)) {
      throw notFound('Payment order not found');
    }

    if (order.status === PAYMENT_ORDER_STATUS.USED) {
      return this.existingResult(order, user);
    }

    if (order.expiresAt.getTime() < Date.now()) {
      if (order.status === PAYMENT_ORDER_STATUS.CREATED) {
        order.status = PAYMENT_ORDER_STATUS.EXPIRED;
        await order.save();
      }
      throw badRequest('Payment order has expired. Create a new order.');
    }

    const claimed = await SubscriptionPaymentOrder.findOneAndUpdate(
      {
        _id: order._id,
        status: { $in: [PAYMENT_ORDER_STATUS.CREATED, PAYMENT_ORDER_STATUS.PAID] },
      },
      {
        $set: {
          status: PAYMENT_ORDER_STATUS.USED,
          paymentId: input.paymentId?.trim() || order.paymentId || newPaymentId(),
        },
      },
      { new: true }
    );
    if (!claimed) {
      const latest = await SubscriptionPaymentOrder.findById(order._id);
      if (latest?.status === PAYMENT_ORDER_STATUS.USED) {
        return this.existingResult(latest, user);
      }
      throw badRequest('Payment order cannot be confirmed in its current state');
    }

    const releaseOrder = () =>
      SubscriptionPaymentOrder.updateOne(
        { _id: claimed._id },
        { $set: { status: PAYMENT_ORDER_STATUS.PAID } }
      );

    const plan = await SubscriptionPlan.findById(claimed.planId);
    if (!plan) {
      await releaseOrder();
      throw notFound('Subscription plan not found');
    }

    const now = new Date();
    let subscription: IAgentSubscriptionDocument;
    let source: IAgentSubscriptionDocument | null = null;

    if (claimed.kind === AGENT_SUBSCRIPTION_KINDS.UPGRADE) {
      source = await AgentSubscription.findOneAndUpdate(
        {
          _id: claimed.upgradeFromSubscriptionId,
          userId: user._id,
          status: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
          endsAt: { $gt: now },
        },
        { $set: { status: AGENT_SUBSCRIPTION_STATUS.UPGRADED } },
        { new: true }
      );
      if (!source) {
        await releaseOrder();
        throw badRequest(
          'Your current plan has changed. Please start the upgrade again.'
        );
      }
      try {
        subscription = await AgentSubscription.create({
          userId: user._id,
          planId: plan._id,
          planTitle: plan.title,
          planPrice: plan.price,
          amountPaid: claimed.amount,
          kind: AGENT_SUBSCRIPTION_KINDS.UPGRADE,
          upgradedFromSubscriptionId: source._id,
          upgradedFromPlanTitle: source.planTitle,
          totalChits: resolvePlanTotalChits(plan),
          features: plan.features,
          billingPeriod: plan.billingPeriod,
          startsAt: now,
          endsAt: source.endsAt,
          status: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
          orderId: claimed.orderId,
          paymentId: claimed.paymentId as string,
        });
      } catch (err) {
        await AgentSubscription.updateOne(
          { _id: source._id },
          { $set: { status: AGENT_SUBSCRIPTION_STATUS.ACTIVE } }
        );
        await releaseOrder();
        throw err;
      }
    } else {
      const active = await findActive(user._id);
      if (active) {
        await releaseOrder();
        throw conflict(
          'You already have an active plan. Upgrade it from the pricing page instead.'
        );
      }
      try {
        subscription = await AgentSubscription.create({
          userId: user._id,
          planId: plan._id,
          planTitle: plan.title,
          planPrice: plan.price,
          amountPaid: claimed.amount,
          kind: AGENT_SUBSCRIPTION_KINDS.NEW,
          totalChits: resolvePlanTotalChits(plan),
          features: plan.features,
          billingPeriod: plan.billingPeriod,
          startsAt: now,
          endsAt: addDays(now, totalValidityDays()),
          status: AGENT_SUBSCRIPTION_STATUS.ACTIVE,
          orderId: claimed.orderId,
          paymentId: claimed.paymentId as string,
        });
      } catch (err) {
        await releaseOrder();
        throw err;
      }
    }

    const invoice = await this.ensureInvoice(subscription, user);
    return {
      kind: subscription.kind,
      subscription: toSubscriptionDto(subscription),
      invoice: toInvoiceDto(invoice, user),
    };
  }

  async listHistory(userId: string) {
    await expireLapsed(userId);
    const rows = await AgentSubscription.find({ userId }).sort({
      startsAt: -1,
      createdAt: -1,
    });
    return { items: rows.map(toSubscriptionDto) };
  }

  async getCurrent(userId: string) {
    const [active, plans, usedChits] = await Promise.all([
      findActive(userId),
      loadAgentPlans(),
      countActiveChits(userId),
    ]);
    const totalChits = active?.totalChits ?? 0;
    const dto = active ? toSubscriptionDto(active) : null;
    const matched = active ? matchCatalogPlan(plans, active) : null;

    return {
      active: dto,
      hasActivePlan: Boolean(active),
      subscribedPlanId: active
        ? (matched?._id ?? active.planId).toString()
        : null,
      totalChits,
      usedChits,
      remainingChits: Math.max(0, totalChits - usedChits),
      limitReached: Boolean(active) && usedChits >= totalChits,
      canCreateChit: Boolean(active) && usedChits < totalChits,
      daysRemaining: dto?.daysRemaining ?? null,
      expiringSoon: dto?.expiringSoon ?? false,
      upgradeOptions: buildUpgradeOptions(plans, active),
    };
  }

  /** Blocks chit creation when the agent has no active plan or is at its limit. */
  async assertCanCreateChit(agentId: string): Promise<void> {
    const [active, usedChits] = await Promise.all([
      findActive(agentId),
      countActiveChits(agentId),
    ]);
    const totalChits = active?.totalChits ?? 0;
    if (active && usedChits < totalChits) return;

    const upgradeOptions = buildUpgradeOptions(await loadAgentPlans(), active);
    if (!active) {
      throw badRequest(API_MESSAGES.SUBSCRIPTION_REQUIRED, {
        reason: SUBSCRIPTION_BLOCK_REASONS.REQUIRED,
        totalChits,
        usedChits,
        upgradeOptions,
      });
    }
    throw badRequest(API_MESSAGES.SUBSCRIPTION_LIMIT_REACHED, {
      reason: SUBSCRIPTION_BLOCK_REASONS.LIMIT_REACHED,
      totalChits,
      usedChits,
      upgradeOptions,
    });
  }

  private async existingResult(
    order: ISubscriptionPaymentOrderDocument,
    user: IUserDocument
  ) {
    const subscription = await AgentSubscription.findOne({
      orderId: order.orderId,
      userId: user._id,
    });
    if (!subscription) {
      throw badRequest('This payment order was already used');
    }
    const invoice = await this.ensureInvoice(subscription, user);
    return {
      kind: subscription.kind,
      subscription: toSubscriptionDto(subscription),
      invoice: toInvoiceDto(invoice, user),
    };
  }

  private async ensureInvoice(
    subscription: IAgentSubscriptionDocument,
    user: IUserDocument
  ) {
    if (subscription.invoiceId) {
      const existing = await Invoice.findById(subscription.invoiceId);
      if (existing) return existing;
    }

    const planTitle =
      subscription.kind === AGENT_SUBSCRIPTION_KINDS.UPGRADE &&
      subscription.upgradedFromPlanTitle
        ? `Upgrade: ${subscription.upgradedFromPlanTitle} to ${subscription.planTitle}`
        : subscription.planTitle;

    const invoice = await invoiceService.createSubscriptionInvoice({
      userId: user._id,
      role: USER_ROLES.AGENT,
      orderId: subscription.orderId,
      paymentId: subscription.paymentId,
      planId: subscription.planId,
      planTitle,
      billingPeriod: subscription.billingPeriod,
      periodStart: subscription.startsAt,
      periodEnd: subscription.endsAt,
      amount: subscription.amountPaid,
      issuedAt: subscription.startsAt,
    });
    subscription.invoiceId = invoice._id;
    await subscription.save();
    return invoice;
  }
}

export const agentSubscriptionService = new AgentSubscriptionService();
