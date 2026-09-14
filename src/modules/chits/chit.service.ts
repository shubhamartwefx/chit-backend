import { FilterQuery, Types } from 'mongoose';
import {
  accessDenied,
  badRequest,
  notFound,
} from '../../common/errors';
import { USER_ROLES, USER_STATUS } from '../../config/constants';
import { JwtPayload } from '../../types/express';
import { User } from '../users/user.model';
import {
  CHIT_STATUS,
  Chit,
  ChitStatus,
  IChitDocument,
  IChitMember,
} from './chit.model';
import {
  buildChitScopeFilter,
  buildScopedChitByIdFilter,
  ChitActor,
} from './chit.scope';
import {
  CreateChitInput,
  ListChitsQueryInput,
  SummaryQueryInput,
  UpdateChitInput,
} from './chit.validation';

type MemberInput = { bidderId: string; numberOfTickets: number };

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function generateChitCode(): string {
  const timePart = Date.now().toString().slice(-8);
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  return `${timePart}${randomPart}`;
}

async function createUniqueChitCode(maxAttempts = 8): Promise<string> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = generateChitCode();
    const exists = await Chit.exists({ chitCode: code });
    if (!exists) {
      return code;
    }
  }
  throw badRequest('Unable to generate a unique chit code. Please retry.');
}

async function resolveBranchStoreIdForAgent(
  agentId: Types.ObjectId
): Promise<Types.ObjectId | null> {
  const agent = await User.findById(agentId).select('role createdBy').lean();
  if (!agent || agent.role !== USER_ROLES.AGENT) {
    throw badRequest('agentId must reference an active agent user');
  }
  if (!agent.createdBy) {
    return null;
  }
  const creator = await User.findById(agent.createdBy).select('role').lean();
  if (creator?.role === USER_ROLES.BRANCH_STORE) {
    return agent.createdBy as Types.ObjectId;
  }
  return null;
}

async function resolveOwnership(
  actor: JwtPayload,
  inputAgentId?: string
): Promise<{ agentId: Types.ObjectId; branchStoreId: Types.ObjectId | null }> {
  if (actor.role === USER_ROLES.AGENT) {
    const agentId = new Types.ObjectId(actor.sub);
    const branchStoreId = await resolveBranchStoreIdForAgent(agentId);
    return { agentId, branchStoreId };
  }

  if (!inputAgentId) {
    throw badRequest('agentId is required for this role');
  }

  const agentId = new Types.ObjectId(inputAgentId);
  const agent = await User.findById(agentId)
    .select('role createdBy status')
    .lean();

  if (!agent || agent.role !== USER_ROLES.AGENT) {
    throw badRequest('agentId must reference an agent user');
  }
  if (agent.status !== USER_STATUS.ACTIVE) {
    throw badRequest('Agent must be active');
  }

  if (actor.role === USER_ROLES.BRANCH_STORE) {
    if (!agent.createdBy || agent.createdBy.toString() !== actor.sub) {
      throw accessDenied(
        'You can only create chits for agents belonging to your branch'
      );
    }
    return {
      agentId,
      branchStoreId: new Types.ObjectId(actor.sub),
    };
  }

  // super_admin
  const branchStoreId = await resolveBranchStoreIdForAgent(agentId);
  return { agentId, branchStoreId };
}

async function validateAndBuildMembers(
  members: MemberInput[] | undefined,
  maxBidders: number
): Promise<IChitMember[]> {
  if (!members || members.length === 0) {
    return [];
  }

  const bidderIds = members.map((m) => m.bidderId);
  const uniqueIds = new Set(bidderIds);
  if (uniqueIds.size !== bidderIds.length) {
    throw badRequest('Duplicate bidder IDs are not allowed in members');
  }

  if (members.length > maxBidders) {
    throw badRequest(
      `members length (${members.length}) exceeds maxBidders (${maxBidders})`
    );
  }

  const objectIds = bidderIds.map((id) => new Types.ObjectId(id));
  const bidders = await User.find({
    _id: { $in: objectIds },
    role: USER_ROLES.BIDDER,
    status: USER_STATUS.ACTIVE,
  })
    .select('_id')
    .lean();

  if (bidders.length !== objectIds.length) {
    throw badRequest(
      'Every members.bidderId must reference an active bidder user'
    );
  }

  const now = new Date();
  return members.map((m) => ({
    bidderId: new Types.ObjectId(m.bidderId),
    numberOfTickets: m.numberOfTickets,
    joinedAt: now,
  }));
}

interface PopulatedBidder {
  _id: Types.ObjectId;
  name?: string;
  phone?: string;
}

function toMemberDto(member: {
  bidderId: Types.ObjectId | PopulatedBidder;
  numberOfTickets: number;
  joinedAt: Date;
}) {
  const bidder = member.bidderId;
  if (bidder && typeof bidder === 'object' && '_id' in bidder) {
    const populated = bidder as PopulatedBidder;
    return {
      bidderId: populated._id.toString(),
      name: populated.name ?? null,
      phone: populated.phone ?? null,
      numberOfTickets: member.numberOfTickets,
      joinedAt: member.joinedAt,
    };
  }
  return {
    bidderId: (bidder as Types.ObjectId).toString(),
    name: null,
    phone: null,
    numberOfTickets: member.numberOfTickets,
    joinedAt: member.joinedAt,
  };
}

function memberBidderIdString(
  bidderId: Types.ObjectId | PopulatedBidder
): string {
  if (bidderId && typeof bidderId === 'object' && '_id' in bidderId) {
    return (bidderId as PopulatedBidder)._id.toString();
  }
  return (bidderId as Types.ObjectId).toString();
}

function filterMembersForActor(
  members: IChitMember[],
  actor?: ChitActor
): IChitMember[] {
  if (actor?.role !== USER_ROLES.BIDDER) {
    return members;
  }
  return members.filter(
    (m) => memberBidderIdString(m.bidderId) === actor.sub
  );
}

function toChitDto(
  chit: IChitDocument | (IChitDocument & { members?: unknown }),
  options?: { includeMembers?: boolean; actor?: ChitActor }
) {
  const completedMonths = chit.completedMonths ?? 0;
  const pendingMonths = Math.max(0, chit.totalMonths - completedMonths);
  const allMembers = Array.isArray(chit.members) ? chit.members : [];
  const visibleMembers = filterMembersForActor(allMembers, options?.actor);

  const base = {
    id: chit._id.toString(),
    chitCode: chit.chitCode,
    type: chit.type,
    amountInLakhs: chit.amountInLakhs,
    govtBettingAmount: chit.govtBettingAmount,
    monthlyInstallment: chit.monthlyInstallment,
    maxBidders: chit.maxBidders,
    totalMonths: chit.totalMonths,
    govtBettingUnits: chit.govtBettingUnits,
    startDate: chit.startDate,
    endDate: chit.endDate,
    completedMonths,
    pendingMonths,
    bidderCount:
      options?.actor?.role === USER_ROLES.BIDDER
        ? visibleMembers.length
        : allMembers.length,
    status: chit.status,
    agentId: chit.agentId?.toString?.() ?? String(chit.agentId),
    branchStoreId: chit.branchStoreId
      ? chit.branchStoreId.toString()
      : null,
    createdBy: chit.createdBy?.toString?.() ?? String(chit.createdBy),
    createdAt: (chit as IChitDocument).createdAt,
    updatedAt: (chit as IChitDocument).updatedAt,
  };

  if (options?.includeMembers) {
    return {
      ...base,
      members: visibleMembers.map((m) =>
        toMemberDto(
          m as {
            bidderId: Types.ObjectId | PopulatedBidder;
            numberOfTickets: number;
            joinedAt: Date;
          }
        )
      ),
    };
  }

  return base;
}

function assertAgentIdFilterAllowed(
  actor: ChitActor,
  agentIdFilter?: string
): void {
  if (!agentIdFilter) {
    return;
  }
  if (
    actor.role !== USER_ROLES.SUPER_ADMIN &&
    actor.role !== USER_ROLES.BRANCH_STORE
  ) {
    throw accessDenied('Only branch store or super admin can filter by agentId');
  }
}

export class ChitService {
  async list(actor: JwtPayload, query: ListChitsQueryInput) {
    assertAgentIdFilterAllowed(actor, query.agentId);

    const includeDeleted =
      query.includeDeleted === true && actor.role === USER_ROLES.SUPER_ADMIN;

    const filter: FilterQuery<IChitDocument> = {
      ...buildChitScopeFilter(actor, { includeDeleted }),
    };

    if (query.amountInLakhs !== undefined) {
      filter.amountInLakhs = query.amountInLakhs;
    }

    if (query.status) {
      if (
        query.status === CHIT_STATUS.DELETED &&
        actor.role !== USER_ROLES.SUPER_ADMIN
      ) {
        throw accessDenied('Only super admin can list deleted chits');
      }
      filter.status = query.status;
    }

    if (query.agentId) {
      filter.agentId = new Types.ObjectId(query.agentId);
    }

    if (query.q) {
      filter.chitCode = { $regex: query.q.trim(), $options: 'i' };
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Chit.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Chit.countDocuments(filter),
    ]);

    return {
      items: items.map((doc) =>
        toChitDto(doc as unknown as IChitDocument, {
          includeMembers: false,
          actor,
        })
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async summary(actor: JwtPayload, query: SummaryQueryInput) {
    assertAgentIdFilterAllowed(actor, query.agentId);

    const includeDeleted =
      query.includeDeleted === true && actor.role === USER_ROLES.SUPER_ADMIN;

    const match: FilterQuery<IChitDocument> = {
      ...buildChitScopeFilter(actor, { includeDeleted }),
    };

    if (query.agentId) {
      match.agentId = new Types.ObjectId(query.agentId);
    }

    const rows = await Chit.aggregate<{
      _id: number;
      chitCount: number;
      bidderCount: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: '$amountInLakhs',
          chitCount: { $sum: 1 },
          bidderCount: { $sum: { $size: '$members' } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      tiers: rows.map((row) => ({
        amountInLakhs: row._id,
        chitCount: row.chitCount,
        bidderCount: row.bidderCount,
      })),
    };
  }

  async getById(actor: JwtPayload, id: string) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, id))
      .populate('members.bidderId', 'name phone')
      .lean();

    if (!chit) {
      throw notFound('Chit not found');
    }

    return toChitDto(chit as unknown as IChitDocument, {
      includeMembers: true,
      actor,
    });
  }

  async create(actor: JwtPayload, input: CreateChitInput) {
    const { agentId, branchStoreId } = await resolveOwnership(
      actor,
      input.agentId
    );

    const maxBidders = input.maxBidders;
    const members = await validateAndBuildMembers(input.members, maxBidders);

    const completedMonths = input.completedMonths ?? 0;
    if (completedMonths > input.totalMonths) {
      throw badRequest('completedMonths cannot exceed totalMonths');
    }

    const startDate = input.startDate;
    const endDate = addMonths(startDate, input.totalMonths);
    const chitCode = await createUniqueChitCode();

    const status: ChitStatus = input.status ?? CHIT_STATUS.ACTIVE;

    const created = await Chit.create({
      chitCode,
      type: input.type,
      amountInLakhs: input.amountInLakhs,
      govtBettingAmount: input.govtBettingAmount,
      monthlyInstallment: input.monthlyInstallment,
      maxBidders,
      totalMonths: input.totalMonths,
      govtBettingUnits: input.govtBettingUnits,
      startDate,
      endDate,
      completedMonths,
      status,
      agentId,
      branchStoreId,
      members,
      createdBy: new Types.ObjectId(actor.sub),
    });

    const populated = await Chit.findById(created._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toChitDto(
      (populated ?? created) as unknown as IChitDocument,
      { includeMembers: true }
    );
  }

  async update(actor: JwtPayload, id: string, input: UpdateChitInput) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, id));
    if (!chit) {
      throw notFound('Chit not found');
    }

    if (input.type !== undefined) chit.type = input.type;
    if (input.amountInLakhs !== undefined) {
      chit.amountInLakhs = input.amountInLakhs;
    }
    if (input.govtBettingAmount !== undefined) {
      chit.govtBettingAmount = input.govtBettingAmount;
    }
    if (input.monthlyInstallment !== undefined) {
      chit.monthlyInstallment = input.monthlyInstallment;
    }
    if (input.govtBettingUnits !== undefined) {
      chit.govtBettingUnits = input.govtBettingUnits;
    }
    if (input.status !== undefined) chit.status = input.status;

    if (input.maxBidders !== undefined) {
      chit.maxBidders = input.maxBidders;
    }

    if (input.totalMonths !== undefined) {
      chit.totalMonths = input.totalMonths;
    }

    if (input.startDate !== undefined) {
      chit.startDate = input.startDate;
    }

    if (input.completedMonths !== undefined) {
      chit.completedMonths = input.completedMonths;
    }

    if (chit.completedMonths > chit.totalMonths) {
      throw badRequest('completedMonths cannot exceed totalMonths');
    }

    if (
      input.startDate !== undefined ||
      input.totalMonths !== undefined
    ) {
      chit.endDate = addMonths(chit.startDate, chit.totalMonths);
    }

    if (input.members !== undefined) {
      chit.members = await validateAndBuildMembers(
        input.members,
        chit.maxBidders
      );
    } else if (chit.members.length > chit.maxBidders) {
      throw badRequest(
        `Current members (${chit.members.length}) exceed maxBidders (${chit.maxBidders}). Reduce members or raise maxBidders.`
      );
    }

    await chit.save();

    const populated = await Chit.findById(chit._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toChitDto(
      (populated ?? chit) as unknown as IChitDocument,
      { includeMembers: true }
    );
  }

  async softDelete(actor: JwtPayload, id: string) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, id));
    if (!chit) {
      throw notFound('Chit not found');
    }

    chit.status = CHIT_STATUS.DELETED;
    await chit.save();

    return {
      id: chit._id.toString(),
      chitCode: chit.chitCode,
      status: chit.status,
    };
  }
}

export const chitService = new ChitService();
