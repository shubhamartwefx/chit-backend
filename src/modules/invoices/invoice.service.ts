import { Types } from 'mongoose';
import { notFound } from '../../common/errors';
import { env } from '../../config/env';
import { USER_ROLES, UserRole } from '../../config/roles';
import { AgentSignupSession } from '../agent-signup/agent-signup.model';
import { BidderSignupSession } from '../bidder-signup/bidder-signup.model';
import {
  PAYMENT_ORDER_STATUS,
  PAYMENT_ROLES,
  SignupPaymentOrder,
} from '../signup-payment/signup-payment.model';
import { IUserDocument, User, VERIFICATION_METHODS } from '../users/user.model';
import {
  IInvoiceDocument,
  INVOICE_SOURCES,
  INVOICE_TYPES,
  Invoice,
  InvoiceCounter,
  InvoiceSource,
} from './invoice.model';
import { ListInvoicesQueryInput } from './invoice.validation';

type BillToUser = Pick<
  IUserDocument,
  'name' | 'countryCode' | 'phone' | 'currentAddress' | 'aadhaarAddress'
>;

type SignupInvoiceSource = {
  paymentRole: (typeof PAYMENT_ROLES)[keyof typeof PAYMENT_ROLES];
  fee: number;
  findSignupSessionId: (userId: Types.ObjectId) => Promise<string | null>;
};

const SIGNUP_INVOICE_SOURCES: Partial<Record<UserRole, SignupInvoiceSource>> = {
  [USER_ROLES.AGENT]: {
    paymentRole: PAYMENT_ROLES.AGENT,
    fee: env.SIGNUP_FEE_AGENT,
    findSignupSessionId: async (userId) => {
      const session = await AgentSignupSession.findOne({ completedUserId: userId })
        .select('sessionId')
        .lean();
      return session?.sessionId ?? null;
    },
  },
  [USER_ROLES.BIDDER]: {
    paymentRole: PAYMENT_ROLES.BIDDER,
    fee: env.SIGNUP_FEE_BIDDER,
    findSignupSessionId: async (userId) => {
      const session = await BidderSignupSession.findOne({ completedUserId: userId })
        .select('sessionId')
        .lean();
      return session?.sessionId ?? null;
    },
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits a tax-inclusive total into subtotal + GST at the configured rate. */
export function splitInclusiveTax(amount: number, taxPercent = env.INVOICE_GST_PERCENT) {
  const total = round2(amount);
  const subtotal = round2(total / (1 + taxPercent / 100));
  return { subtotal, taxPercent, taxAmount: round2(total - subtotal), amount: total };
}

async function nextInvoiceNumber(issuedAt: Date): Promise<string> {
  const year = issuedAt.getFullYear();
  const counter = await InvoiceCounter.findOneAndUpdate(
    { key: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `INV-${year}-${String(counter.seq).padStart(6, '0')}`;
}

function typeLabel(doc: IInvoiceDocument): string {
  if (doc.type === INVOICE_TYPES.SUBSCRIPTION) return 'Subscription';
  return doc.verificationMethod === VERIFICATION_METHODS.MANUAL
    ? 'Aadhaar verification'
    : 'DigiLocker verification';
}

function planLabel(doc: IInvoiceDocument): string {
  if (doc.type === INVOICE_TYPES.SUBSCRIPTION) return doc.planTitle || 'Subscription plan';
  return 'Signup verification';
}

function formatAddress(user: BillToUser | null): string | null {
  const addr = user?.currentAddress || user?.aadhaarAddress;
  if (!addr) return null;
  return [addr.street, addr.city, addr.state, addr.pincode, addr.country]
    .filter(Boolean)
    .join(', ');
}

export function toInvoiceDto(doc: IInvoiceDocument, user: BillToUser | null) {
  return {
    id: doc._id.toString(),
    invoiceNumber: doc.invoiceNumber,
    orderNumber: doc.orderNumber,
    paymentId: doc.paymentId ?? null,
    type: doc.type,
    typeLabel: typeLabel(doc),
    planLabel: planLabel(doc),
    verificationMethod: doc.verificationMethod ?? null,
    planId: doc.planId ? doc.planId.toString() : null,
    planTitle: doc.planTitle ?? null,
    billingPeriod: doc.billingPeriod ?? null,
    periodStart: doc.periodStart ? doc.periodStart.toISOString() : null,
    periodEnd: doc.periodEnd ? doc.periodEnd.toISOString() : null,
    subtotal: doc.subtotal,
    discount: 0,
    taxPercent: doc.taxPercent,
    taxAmount: doc.taxAmount,
    amount: doc.amount,
    amountDue: 0,
    currency: doc.currency,
    status: doc.status,
    source: doc.source,
    issuedAt: doc.issuedAt.toISOString(),
    billTo: {
      name: user?.name ?? null,
      countryCode: user?.countryCode ?? null,
      phone: user?.phone ?? null,
      address: formatAddress(user),
    },
  };
}

export type InvoiceDto = ReturnType<typeof toInvoiceDto>;

export class InvoiceService {
  async createSignupInvoice(input: {
    userId: Types.ObjectId | string;
    role: string;
    orderId: string;
    paymentId?: string | null;
    amount: number;
    verificationMethod?: string | null;
    issuedAt?: Date;
    source?: InvoiceSource;
  }): Promise<IInvoiceDocument> {
    const issuedAt = input.issuedAt ?? new Date();
    return Invoice.create({
      userId: input.userId,
      role: input.role,
      type: INVOICE_TYPES.SIGNUP_VERIFICATION,
      invoiceNumber: await nextInvoiceNumber(issuedAt),
      orderNumber: input.orderId,
      paymentId: input.paymentId ?? null,
      verificationMethod: input.verificationMethod ?? null,
      ...splitInclusiveTax(input.amount),
      currency: 'INR',
      source: input.source ?? INVOICE_SOURCES.PAYMENT,
      issuedAt,
    });
  }

  async createSubscriptionInvoice(input: {
    userId: Types.ObjectId | string;
    role: string;
    orderId: string;
    paymentId: string;
    planId: Types.ObjectId | string;
    planTitle: string;
    billingPeriod: string;
    periodStart: Date;
    periodEnd: Date;
    amount: number;
    issuedAt?: Date;
  }): Promise<IInvoiceDocument> {
    const issuedAt = input.issuedAt ?? new Date();
    return Invoice.create({
      userId: input.userId,
      role: input.role,
      type: INVOICE_TYPES.SUBSCRIPTION,
      invoiceNumber: await nextInvoiceNumber(issuedAt),
      orderNumber: input.orderId,
      paymentId: input.paymentId,
      planId: input.planId,
      planTitle: input.planTitle,
      billingPeriod: input.billingPeriod,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      ...splitInclusiveTax(input.amount),
      currency: 'INR',
      source: INVOICE_SOURCES.PAYMENT,
      issuedAt,
    });
  }

  /**
   * Agents and bidders registered before signup invoices existed have none.
   * Rebuild it from the used signup payment order when the signup session still
   * exists, otherwise from the configured role fee and the account creation date.
   * Admin-provisioned users never paid a signup fee and are skipped.
   */
  async ensureSignupInvoice(user: IUserDocument): Promise<void> {
    const source = SIGNUP_INVOICE_SOURCES[user.role];
    if (!source) return;
    if (
      user.verificationMethod !== VERIFICATION_METHODS.DIGILOCKER &&
      user.verificationMethod !== VERIFICATION_METHODS.MANUAL
    ) {
      return;
    }

    const existing = await Invoice.exists({
      userId: user._id,
      type: INVOICE_TYPES.SIGNUP_VERIFICATION,
    });
    if (existing) return;

    const sessionId = await source.findSignupSessionId(user._id);
    const order = sessionId
      ? await SignupPaymentOrder.findOne({
          sessionId,
          role: source.paymentRole,
          status: PAYMENT_ORDER_STATUS.USED,
        }).lean()
      : null;

    try {
      await this.createSignupInvoice({
        userId: user._id,
        role: user.role,
        orderId: order?.orderId ?? `SIGNUP-${user._id.toString().slice(-8).toUpperCase()}`,
        paymentId: order?.paymentId ?? null,
        amount: order?.amount ?? source.fee,
        verificationMethod: user.verificationMethod,
        issuedAt: order?.updatedAt ?? user.createdAt,
        source: INVOICE_SOURCES.BACKFILL,
      });
    } catch (err: unknown) {
      const code = (err as { code?: number } | null)?.code;
      if (code !== 11000) throw err;
    }
  }

  async listForUser(userId: string, query: ListInvoicesQueryInput) {
    const user = await User.findById(userId);
    if (!user) throw notFound('User not found');

    await this.ensureSignupInvoice(user);

    const filter: Record<string, unknown> = { userId: user._id };
    const q = query.q?.trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ orderNumber: rx }, { invoiceNumber: rx }, { planTitle: rx }];
    }

    const docs = await Invoice.find(filter).sort({ issuedAt: -1, _id: -1 });
    return { items: docs.map((doc) => toInvoiceDto(doc, user)) };
  }

  async getForUser(userId: string, invoiceId: string): Promise<InvoiceDto> {
    const [user, doc] = await Promise.all([
      User.findById(userId),
      Invoice.findOne({ _id: invoiceId, userId }),
    ]);
    if (!doc) throw notFound('Invoice not found');
    return toInvoiceDto(doc, user);
  }
}

export const invoiceService = new InvoiceService();
