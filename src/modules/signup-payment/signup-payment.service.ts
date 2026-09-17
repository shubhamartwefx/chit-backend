import crypto from 'crypto';
import { badRequest, notFound } from '../../common/errors';
import { env } from '../../config/env';
import { AgentSignupSession, SIGNUP_STATUS as AGENT_SIGNUP_STATUS } from '../agent-signup/agent-signup.model';
import { BidderSignupSession, SIGNUP_STATUS as BIDDER_SIGNUP_STATUS } from '../bidder-signup/bidder-signup.model';
import {
  ConfirmPaymentInput,
  CreateOrderInput,
} from './signup-payment.validation';
import {
  PAYMENT_ORDER_STATUS,
  PAYMENT_ROLES,
  PaymentRole,
  SignupPaymentOrder,
} from './signup-payment.model';

const ORDER_TTL_MINUTES = 30;

function feeForRole(role: PaymentRole): number {
  return role === PAYMENT_ROLES.AGENT
    ? env.SIGNUP_FEE_AGENT
    : env.SIGNUP_FEE_BIDDER;
}

function newOrderId(): string {
  return `order_demo_${crypto.randomBytes(12).toString('hex')}`;
}

function newPaymentId(): string {
  return `pay_demo_${crypto.randomBytes(12).toString('hex')}`;
}

async function assertVerifiedSignupSession(
  role: PaymentRole,
  sessionId: string
): Promise<void> {
  if (role === PAYMENT_ROLES.AGENT) {
    const session = await AgentSignupSession.findOne({ sessionId });
    if (!session) throw notFound('Signup session not found');
    if (session.status !== AGENT_SIGNUP_STATUS.VERIFIED) {
      throw badRequest(
        'Complete Aadhaar verification before creating a payment order'
      );
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw badRequest('Signup session has expired');
    }
    return;
  }

  const session = await BidderSignupSession.findOne({ sessionId });
  if (!session) throw notFound('Signup session not found');
  if (session.status !== BIDDER_SIGNUP_STATUS.VERIFIED) {
    throw badRequest(
      'Complete Aadhaar verification before creating a payment order'
    );
  }
  if (session.expiresAt.getTime() < Date.now()) {
    throw badRequest('Signup session has expired');
  }
}

export class SignupPaymentService {
  async createOrder(input: CreateOrderInput) {
    await assertVerifiedSignupSession(input.role, input.sessionId);

    const existing = await SignupPaymentOrder.findOne({
      sessionId: input.sessionId,
      role: input.role,
      status: {
        $in: [PAYMENT_ORDER_STATUS.CREATED, PAYMENT_ORDER_STATUS.PAID],
      },
    }).sort({ createdAt: -1 });

    if (existing && existing.expiresAt.getTime() > Date.now()) {
      if (existing.status === PAYMENT_ORDER_STATUS.EXPIRED) {
        // fall through
      } else {
        return {
          orderId: existing.orderId,
          amount: existing.amount,
          currency: existing.currency,
          keyId: 'demo',
          mode: env.PAYMENT_MODE,
          status: existing.status,
          expiresAt: existing.expiresAt.toISOString(),
        };
      }
    }

    const order = await SignupPaymentOrder.create({
      orderId: newOrderId(),
      role: input.role,
      sessionId: input.sessionId,
      amount: feeForRole(input.role),
      currency: 'INR',
      status: PAYMENT_ORDER_STATUS.CREATED,
      expiresAt: new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000),
    });

    return {
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: 'demo',
      mode: env.PAYMENT_MODE,
      status: order.status,
      expiresAt: order.expiresAt.toISOString(),
    };
  }

  async confirm(input: ConfirmPaymentInput) {
    const order = await SignupPaymentOrder.findOne({ orderId: input.orderId });
    if (!order) throw notFound('Payment order not found');

    if (order.expiresAt.getTime() < Date.now()) {
      if (order.status === PAYMENT_ORDER_STATUS.CREATED) {
        order.status = PAYMENT_ORDER_STATUS.EXPIRED;
        await order.save();
      }
      throw badRequest('Payment order has expired. Create a new order.');
    }

    if (order.status === PAYMENT_ORDER_STATUS.USED) {
      throw badRequest('This payment was already used to complete registration');
    }

    if (order.status === PAYMENT_ORDER_STATUS.PAID) {
      return {
        orderId: order.orderId,
        paymentId: order.paymentId,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        role: order.role,
        sessionId: order.sessionId,
      };
    }

    if (order.status !== PAYMENT_ORDER_STATUS.CREATED) {
      throw badRequest('Payment order cannot be confirmed in its current state');
    }

    order.status = PAYMENT_ORDER_STATUS.PAID;
    order.paymentId = input.paymentId?.trim() || newPaymentId();
    await order.save();

    return {
      orderId: order.orderId,
      paymentId: order.paymentId,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      role: order.role,
      sessionId: order.sessionId,
    };
  }

  async getOrder(orderId: string) {
    const order = await SignupPaymentOrder.findOne({ orderId });
    if (!order) throw notFound('Payment order not found');

    if (
      order.status === PAYMENT_ORDER_STATUS.CREATED &&
      order.expiresAt.getTime() < Date.now()
    ) {
      order.status = PAYMENT_ORDER_STATUS.EXPIRED;
      await order.save();
    }

    return {
      orderId: order.orderId,
      role: order.role,
      sessionId: order.sessionId,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      paymentId: order.paymentId ?? null,
      expiresAt: order.expiresAt.toISOString(),
      mode: env.PAYMENT_MODE,
    };
  }

  /**
   * Validates a paid order for signup complete, then marks it used.
   */
  async consumePaidOrder(input: {
    role: PaymentRole;
    sessionId: string;
    paymentId: string;
  }) {
    const order = await SignupPaymentOrder.findOne({
      paymentId: input.paymentId,
      role: input.role,
      sessionId: input.sessionId,
    });

    if (!order) {
      throw badRequest(
        'Valid paid signup payment is required. Complete demo payment first.'
      );
    }

    if (order.status === PAYMENT_ORDER_STATUS.USED) {
      throw badRequest('This payment was already used to complete registration');
    }

    if (order.status !== PAYMENT_ORDER_STATUS.PAID) {
      throw badRequest('Signup payment is not paid yet');
    }

    if (order.expiresAt.getTime() < Date.now()) {
      throw badRequest('Signup payment has expired. Pay again.');
    }

    order.status = PAYMENT_ORDER_STATUS.USED;
    await order.save();

    return {
      orderId: order.orderId,
      paymentId: order.paymentId as string,
      amount: order.amount,
    };
  }
}

export const signupPaymentService = new SignupPaymentService();
