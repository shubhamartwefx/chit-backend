import { Types } from 'mongoose';
import { USER_ROLES, USER_STATUS } from '../../config/roles';
import { JwtPayload } from '../../types/express';
import { AuctionRound, AUCTION_ROUND_STATUS } from '../auctions/auction.model';
import { Chit } from '../chits/chit.model';
import { buildChitScopeFilter } from '../chits/chit.scope';
import { Installment, INSTALLMENT_STATUS } from '../installments/installment.model';
import { User } from '../users/user.model';

export class ReportsService {
  async overview(actor: JwtPayload) {
    const chitFilter = buildChitScopeFilter(actor);
    const isSuperAdmin = actor.role === USER_ROLES.SUPER_ADMIN;

    const [
      usersByRole,
      usersByStatus,
      chitsByStatus,
      chitsByType,
      installmentPaid,
      installmentPending,
      openAuctionRounds,
      closedAuctionRounds,
    ] = await Promise.all([
      isSuperAdmin
        ? User.aggregate<{ _id: string; count: number }>([
            { $group: { _id: '$role', count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      isSuperAdmin
        ? User.aggregate<{ _id: string; count: number }>([
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      Chit.aggregate<{ _id: string; count: number }>([
        { $match: chitFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Chit.aggregate<{ _id: string; count: number }>([
        { $match: chitFilter },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.countInstallments(actor, INSTALLMENT_STATUS.PAID),
      this.countInstallments(actor, INSTALLMENT_STATUS.PENDING),
      this.countAuctionRounds(actor, AUCTION_ROUND_STATUS.OPEN),
      this.countAuctionRounds(actor, AUCTION_ROUND_STATUS.CLOSED),
    ]);

    const toMap = (rows: { _id: string; count: number }[]) =>
      Object.fromEntries(rows.map((r) => [r._id, r.count]));

    const scopedChitCount = await Chit.countDocuments(chitFilter);

    const result: Record<string, unknown> = {
      scope: actor.role,
      chits: {
        total: scopedChitCount,
        byStatus: toMap(chitsByStatus),
        byType: toMap(chitsByType),
      },
      installments: {
        paid: installmentPaid,
        pending: installmentPending,
      },
      auctions: {
        openRounds: openAuctionRounds,
        closedRounds: closedAuctionRounds,
      },
    };

    if (isSuperAdmin) {
      result.users = {
        byRole: toMap(usersByRole),
        byStatus: toMap(usersByStatus),
        blocked:
          toMap(usersByStatus)[USER_STATUS.BLOCKED] ?? 0,
      };
    } else if (
      actor.role === USER_ROLES.AGENT ||
      actor.role === USER_ROLES.BRANCH_STORE
    ) {
      const createdBidders = await User.countDocuments({
        role: USER_ROLES.BIDDER,
        createdBy: new Types.ObjectId(actor.sub),
      });
      const blockedCreated = await User.countDocuments({
        role: USER_ROLES.BIDDER,
        createdBy: new Types.ObjectId(actor.sub),
        status: USER_STATUS.BLOCKED,
      });
      result.bidders = {
        created: createdBidders,
        blockedCreated,
      };
    }

    return result;
  }

  private async countInstallments(
    actor: JwtPayload,
    status: string
  ): Promise<number> {
    const chitIds = await Chit.find(buildChitScopeFilter(actor))
      .select('_id')
      .lean();
    if (chitIds.length === 0) return 0;
    return Installment.countDocuments({
      chitId: { $in: chitIds.map((c) => c._id) },
      status,
    });
  }

  private async countAuctionRounds(
    actor: JwtPayload,
    status: string
  ): Promise<number> {
    const chitIds = await Chit.find(buildChitScopeFilter(actor))
      .select('_id')
      .lean();
    if (chitIds.length === 0) return 0;
    return AuctionRound.countDocuments({
      chitId: { $in: chitIds.map((c) => c._id) },
      status,
    });
  }
}

export const reportsService = new ReportsService();
