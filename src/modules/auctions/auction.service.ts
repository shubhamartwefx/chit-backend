import { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../../common/errors';
import { USER_ROLES } from '../../config/roles';
import { JwtPayload } from '../../types/express';
import { Chit, CHIT_STATUS, CHIT_TYPES } from '../chits/chit.model';
import { buildScopedChitByIdFilter } from '../chits/chit.scope';
import {
  AuctionRound,
  AUCTION_ROUND_STATUS,
  IAuctionRoundDocument,
} from './auction.model';
import {
  CloseAuctionRoundInput,
  CreateAuctionRoundInput,
  ListAuctionRoundsQueryInput,
  PlaceBidInput,
} from './auction.validation';

function toRoundDto(
  round: IAuctionRoundDocument | Record<string, unknown>,
  options?: { includeBids?: boolean; actor?: JwtPayload }
) {
  const r = round as IAuctionRoundDocument;
  const allBids = Array.isArray(r.bids) ? r.bids : [];
  let bids = allBids;
  if (options?.actor?.role === USER_ROLES.BIDDER) {
    bids = allBids.filter((b) => b.bidderId.toString() === options.actor!.sub);
  }

  const base = {
    id: r._id.toString(),
    chitId: r.chitId.toString(),
    roundNumber: r.roundNumber,
    monthNumber: r.monthNumber,
    status: r.status,
    opensAt: r.opensAt,
    closesAt: r.closesAt,
    winnerBidderId: r.winnerBidderId ? r.winnerBidderId.toString() : null,
    winningBidAmount: r.winningBidAmount ?? null,
    bidCount: allBids.length,
    createdBy: r.createdBy.toString(),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };

  if (options?.includeBids) {
    return {
      ...base,
      bids: bids.map((b) => ({
        bidderId: b.bidderId.toString(),
        amount: b.amount,
        placedAt: b.placedAt,
      })),
    };
  }

  return base;
}

export class AuctionService {
  async createRound(
    actor: JwtPayload,
    chitId: string,
    input: CreateAuctionRoundInput
  ) {
    if (actor.role === USER_ROLES.BIDDER) {
      throw badRequest('Bidders cannot open auction rounds');
    }

    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit || chit.status === CHIT_STATUS.DELETED) {
      throw notFound('Chit not found');
    }
    if (chit.type !== CHIT_TYPES.AUCTION_CHIT) {
      throw badRequest('Auction rounds are only allowed for auction_chit');
    }
    if (input.monthNumber > chit.totalMonths) {
      throw badRequest('monthNumber cannot exceed chit totalMonths');
    }

    try {
      const created = await AuctionRound.create({
        chitId: chit._id,
        roundNumber: input.roundNumber,
        monthNumber: input.monthNumber,
        status: AUCTION_ROUND_STATUS.OPEN,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        bids: [],
        createdBy: new Types.ObjectId(actor.sub),
      });
      return toRoundDto(created, { includeBids: true, actor });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: number }).code === 11000
      ) {
        throw conflict('An auction round with this roundNumber already exists');
      }
      throw err;
    }
  }

  async listRounds(
    actor: JwtPayload,
    chitId: string,
    query: ListAuctionRoundsQueryInput
  ) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit) {
      throw notFound('Chit not found');
    }

    const filter: Record<string, unknown> = { chitId: chit._id };
    if (query.status) {
      filter.status = query.status;
    }

    const rounds = await AuctionRound.find(filter)
      .sort({ roundNumber: 1 })
      .lean();

    return {
      items: rounds.map((r) =>
        toRoundDto(r as unknown as IAuctionRoundDocument, {
          includeBids: false,
          actor,
        })
      ),
    };
  }

  async getRound(actor: JwtPayload, chitId: string, roundId: string) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit) {
      throw notFound('Chit not found');
    }

    const round = await AuctionRound.findOne({
      _id: new Types.ObjectId(roundId),
      chitId: chit._id,
    }).lean();

    if (!round) {
      throw notFound('Auction round not found');
    }

    return toRoundDto(round as unknown as IAuctionRoundDocument, {
      includeBids: true,
      actor,
    });
  }

  async placeBid(
    actor: JwtPayload,
    chitId: string,
    roundId: string,
    input: PlaceBidInput
  ) {
    if (actor.role !== USER_ROLES.BIDDER) {
      throw badRequest('Only bidders can place bids');
    }

    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit || chit.status !== CHIT_STATUS.ACTIVE) {
      throw notFound('Chit not found');
    }

    const isMember = chit.members.some(
      (m) => m.bidderId.toString() === actor.sub
    );
    if (!isMember) {
      throw badRequest('You must be a member of this chit to bid');
    }

    const round = await AuctionRound.findOne({
      _id: new Types.ObjectId(roundId),
      chitId: chit._id,
    });
    if (!round) {
      throw notFound('Auction round not found');
    }
    if (round.status !== AUCTION_ROUND_STATUS.OPEN) {
      throw badRequest('Auction round is not open for bidding');
    }

    const now = new Date();
    if (now < round.opensAt || now > round.closesAt) {
      throw badRequest('Bidding is outside the open window');
    }

    const existingIdx = round.bids.findIndex(
      (b) => b.bidderId.toString() === actor.sub
    );
    if (existingIdx >= 0) {
      round.bids[existingIdx].amount = input.amount;
      round.bids[existingIdx].placedAt = now;
    } else {
      round.bids.push({
        bidderId: new Types.ObjectId(actor.sub),
        amount: input.amount,
        placedAt: now,
      });
    }

    await round.save();
    return toRoundDto(round, { includeBids: true, actor });
  }

  async closeRound(
    actor: JwtPayload,
    chitId: string,
    roundId: string,
    input: CloseAuctionRoundInput
  ) {
    if (actor.role === USER_ROLES.BIDDER) {
      throw badRequest('Bidders cannot close auction rounds');
    }

    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit) {
      throw notFound('Chit not found');
    }

    const round = await AuctionRound.findOne({
      _id: new Types.ObjectId(roundId),
      chitId: chit._id,
    });
    if (!round) {
      throw notFound('Auction round not found');
    }
    if (round.status !== AUCTION_ROUND_STATUS.OPEN) {
      throw conflict('Auction round is not open');
    }

    let winnerId = input.winnerBidderId;
    let winningAmount: number | null = null;

    if (winnerId) {
      const bid = round.bids.find((b) => b.bidderId.toString() === winnerId);
      if (!bid) {
        throw badRequest('winnerBidderId must have placed a bid');
      }
      winningAmount = bid.amount;
    } else if (round.bids.length > 0) {
      // Lowest bid wins (typical chit auction discount).
      const sorted = [...round.bids].sort((a, b) => a.amount - b.amount);
      winnerId = sorted[0].bidderId.toString();
      winningAmount = sorted[0].amount;
    }

    round.status = AUCTION_ROUND_STATUS.CLOSED;
    round.winnerBidderId = winnerId
      ? new Types.ObjectId(winnerId)
      : null;
    round.winningBidAmount = winningAmount;
    await round.save();

    return toRoundDto(round, { includeBids: true, actor });
  }
}

export const auctionService = new AuctionService();
