/**
 * Lightweight validation smoke checks for month-detail Zod schemas.
 * Run: npx tsx src/scripts/smoke-month-details.ts
 */
import {
  agentTakenMonthDetailSchema,
  bidderPaymentMonthDetailSchema,
  createInstallmentSchema,
  skipMonthDetailSchema,
  updateInstallmentSchema,
} from '../modules/installments/installment.validation';

const BIDDER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const create = createInstallmentSchema.parse({
    bidderId: BIDDER_ID,
    monthNumber: 1,
    amount: 5000,
    balanceAmount: 1000,
    unpaidBidderIds: [OTHER_ID],
  });
  assert(create.balanceAmount === 1000, 'balanceAmount missing on create');
  assert(create.status === 'paid', 'default status should be paid');

  const bidderPay = bidderPaymentMonthDetailSchema.parse({
    bidderId: BIDDER_ID,
    monthNumber: 2,
  });
  assert(bidderPay.monthNumber === 2, 'bidder payment month');

  const agentTaken = agentTakenMonthDetailSchema.parse({
    monthNumber: 3,
    amount: 5000,
    unpaidBidderIds: [BIDDER_ID],
  });
  assert(agentTaken.unpaidBidderIds?.length === 1, 'agent taken unpaid');

  const skip = skipMonthDetailSchema.parse({
    monthNumber: 4,
    skipReason: 'Festival',
    amount: 0,
  });
  assert(skip.skipReason === 'Festival', 'skip reason');

  const update = updateInstallmentSchema.parse({
    amount: 5500,
    balanceAmount: 200,
  });
  assert(update.amount === 5500, 'update amount');

  let threw = false;
  try {
    updateInstallmentSchema.parse({});
  } catch {
    threw = true;
  }
  assert(threw, 'empty update should fail');

  console.log('smoke-month-details: all checks passed');
}

run();
