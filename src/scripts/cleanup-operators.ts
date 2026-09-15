/**
 * One-off cleanup: remove agent, bidder, and branch_store users and related data.
 * Keeps super_admin accounts.
 *
 * Usage: npx tsx src/scripts/cleanup-operators.ts
 */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db';
import { USER_ROLES } from '../config/roles';
import { AuctionRound } from '../modules/auctions/auction.model';
import { AgentSignupSession } from '../modules/agent-signup/agent-signup.model';
import { RefreshSession } from '../modules/auth/refresh-session.model';
import { BidderSignupSession } from '../modules/bidder-signup/bidder-signup.model';
import { Chit } from '../modules/chits/chit.model';
import { Installment } from '../modules/installments/installment.model';
import { OtpSession } from '../modules/otp/otp.model';
import { SignupPaymentOrder } from '../modules/signup-payment/signup-payment.model';
import { User } from '../modules/users/user.model';

const TARGET_ROLES = [
  USER_ROLES.AGENT,
  USER_ROLES.BIDDER,
  USER_ROLES.BRANCH_STORE,
] as const;

async function cleanup() {
  await connectDatabase();

  const targets = await User.find({ role: { $in: [...TARGET_ROLES] } })
    .select('_id role phone name')
    .lean();

  const ids = targets.map((u) => u._id);
  console.log(
    `Found ${targets.length} users to remove:`,
    targets.map((u) => `${u.role}:${u.phone}`).join(', ') || '(none)'
  );

  const chits = await Chit.find({
    $or: [
      { agentId: { $in: ids } },
      { branchStoreId: { $in: ids } },
      { createdBy: { $in: ids } },
      { 'members.bidderId': { $in: ids } },
    ],
  })
    .select('_id')
    .lean();
  const chitIds = chits.map((c) => c._id);

  const [
    installments,
    auctions,
    refresh,
    otp,
    agentSignup,
    bidderSignup,
    payments,
    deletedChits,
    deletedUsers,
  ] = await Promise.all([
    Installment.deleteMany({
      $or: [
        { chitId: { $in: chitIds } },
        { bidderId: { $in: ids } },
        { recordedBy: { $in: ids } },
      ],
    }),
    AuctionRound.deleteMany({
      $or: [{ chitId: { $in: chitIds } }, { createdBy: { $in: ids } }],
    }),
    RefreshSession.deleteMany({ userId: { $in: ids } }),
    OtpSession.deleteMany({ role: { $in: [...TARGET_ROLES] } }),
    AgentSignupSession.deleteMany({}),
    BidderSignupSession.deleteMany({}),
    SignupPaymentOrder.deleteMany({}),
    Chit.deleteMany({ _id: { $in: chitIds } }),
    User.deleteMany({ _id: { $in: ids } }),
  ]);

  console.log('Deleted counts:', {
    users: deletedUsers.deletedCount ?? 0,
    chits: deletedChits.deletedCount ?? 0,
    installments: installments.deletedCount ?? 0,
    auctionRounds: auctions.deletedCount ?? 0,
    refreshSessions: refresh.deletedCount ?? 0,
    otpSessions: otp.deletedCount ?? 0,
    agentSignupSessions: agentSignup.deletedCount ?? 0,
    bidderSignupSessions: bidderSignup.deletedCount ?? 0,
    signupPayments: payments.deletedCount ?? 0,
  });

  const remaining = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log('Remaining users by role:', remaining);

  await mongoose.disconnect();
}

cleanup().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
