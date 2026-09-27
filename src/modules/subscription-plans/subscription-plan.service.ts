import { Types } from 'mongoose';
import { badRequest, notFound } from '../../common/errors';
import {
  SUBSCRIPTION_BILLING_PERIODS,
  SUBSCRIPTION_PLAN_AUDIENCES,
  SUBSCRIPTION_PLAN_STATUS,
  SubscriptionPlan,
  SubscriptionPlanAudience,
  ISubscriptionPlanDocument,
} from './subscription-plan.model';
import {
  BulkUpsertSubscriptionPlansInput,
  CreateSubscriptionPlanInput,
  ListSubscriptionPlansQueryInput,
  UpdateSubscriptionPlanInput,
} from './subscription-plan.validation';

function toDto(doc: ISubscriptionPlanDocument) {
  return {
    id: doc._id.toString(),
    audience: doc.audience,
    title: doc.title,
    subtitle: doc.subtitle,
    price: doc.price,
    billingPeriod: doc.billingPeriod,
    features: doc.features,
    icon: doc.icon,
    bgClass: doc.bgClass,
    colorClass: doc.colorClass,
    btnType: doc.btnType,
    btnClass: doc.btnClass,
    cardBorder: doc.cardBorder ?? null,
    sortOrder: doc.sortOrder,
    status: doc.status,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function loadActive(id: string): Promise<ISubscriptionPlanDocument> {
  if (!Types.ObjectId.isValid(id)) throw notFound('Subscription plan not found');
  const doc = await SubscriptionPlan.findOne({
    _id: new Types.ObjectId(id),
    status: { $ne: SUBSCRIPTION_PLAN_STATUS.DELETED },
  });
  if (!doc) throw notFound('Subscription plan not found');
  return doc;
}

export class SubscriptionPlanService {
  async list(query: ListSubscriptionPlansQueryInput) {
    const audience =
      query.audience ?? SUBSCRIPTION_PLAN_AUDIENCES.AGENT;
    const rows = await SubscriptionPlan.find({
      audience,
      status: { $ne: SUBSCRIPTION_PLAN_STATUS.DELETED },
    }).sort({ sortOrder: 1, createdAt: 1 });

    return { items: rows.map(toDto) };
  }

  async getById(id: string) {
    const doc = await loadActive(id);
    return toDto(doc);
  }

  async create(actorId: string, input: CreateSubscriptionPlanInput) {
    const doc = await SubscriptionPlan.create({
      audience: input.audience ?? SUBSCRIPTION_PLAN_AUDIENCES.AGENT,
      title: input.title,
      subtitle: input.subtitle,
      price: input.price,
      billingPeriod:
        input.billingPeriod ?? SUBSCRIPTION_BILLING_PERIODS.YEAR,
      features: input.features,
      icon: input.icon,
      bgClass: input.bgClass,
      colorClass: input.colorClass,
      btnType: input.btnType ?? 'a',
      btnClass: input.btnClass,
      cardBorder: input.cardBorder ?? null,
      sortOrder: input.sortOrder ?? 0,
      status: SUBSCRIPTION_PLAN_STATUS.ACTIVE,
      createdBy: new Types.ObjectId(actorId),
    });
    return toDto(doc);
  }

  async update(id: string, input: UpdateSubscriptionPlanInput) {
    const doc = await loadActive(id);
    if (input.audience !== undefined) doc.audience = input.audience;
    if (input.title !== undefined) doc.title = input.title;
    if (input.subtitle !== undefined) doc.subtitle = input.subtitle;
    if (input.price !== undefined) doc.price = input.price;
    if (input.billingPeriod !== undefined) {
      doc.billingPeriod = input.billingPeriod;
    }
    if (input.features !== undefined) doc.features = input.features;
    if (input.icon !== undefined) doc.icon = input.icon;
    if (input.bgClass !== undefined) doc.bgClass = input.bgClass;
    if (input.colorClass !== undefined) doc.colorClass = input.colorClass;
    if (input.btnType !== undefined) doc.btnType = input.btnType;
    if (input.btnClass !== undefined) doc.btnClass = input.btnClass;
    if (input.cardBorder !== undefined) {
      doc.cardBorder = input.cardBorder ?? null;
    }
    if (input.sortOrder !== undefined) doc.sortOrder = input.sortOrder;
    await doc.save();
    return toDto(doc);
  }

  async remove(id: string) {
    const doc = await loadActive(id);
    doc.status = SUBSCRIPTION_PLAN_STATUS.DELETED;
    await doc.save();
    return { id: doc._id.toString(), deleted: true };
  }

  /**
   * Replace the active catalog for an audience with the provided plans array.
   * Soft-deletes existing active plans, then inserts the new set in order.
   */
  async bulkUpsert(actorId: string, input: BulkUpsertSubscriptionPlansInput) {
    const audience = input.audience as SubscriptionPlanAudience;
    if (!input.plans?.length) {
      throw badRequest('plans array must contain at least one plan');
    }

    await SubscriptionPlan.updateMany(
      {
        audience,
        status: { $ne: SUBSCRIPTION_PLAN_STATUS.DELETED },
      },
      { $set: { status: SUBSCRIPTION_PLAN_STATUS.DELETED } }
    );

    const createdBy = new Types.ObjectId(actorId);
    const docs = await SubscriptionPlan.insertMany(
      input.plans.map((p, index) => ({
        audience,
        title: p.title,
        subtitle: p.subtitle,
        price: p.price,
        billingPeriod:
          p.billingPeriod ?? SUBSCRIPTION_BILLING_PERIODS.YEAR,
        features: p.features,
        icon: p.icon,
        bgClass: p.bgClass,
        colorClass: p.colorClass,
        btnType: p.btnType ?? 'a',
        btnClass: p.btnClass,
        cardBorder: p.cardBorder ?? null,
        sortOrder: p.sortOrder ?? index,
        status: SUBSCRIPTION_PLAN_STATUS.ACTIVE,
        createdBy,
      }))
    );

    return {
      audience,
      items: docs.map((d) => toDto(d as ISubscriptionPlanDocument)),
    };
  }
}

export const subscriptionPlanService = new SubscriptionPlanService();
