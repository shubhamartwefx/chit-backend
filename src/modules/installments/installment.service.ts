import { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../../common/errors';
import { USER_ROLES } from '../../config/roles';
import { JwtPayload } from '../../types/express';
import { Chit, CHIT_STATUS, IChitDocument } from '../chits/chit.model';
import {
  buildChitScopeFilter,
  buildScopedChitByIdFilter,
} from '../chits/chit.scope';
import {
  AgentTakenMonthDetailInput,
  BidderPaymentMonthDetailInput,
  CreateInstallmentInput,
  ListInstallmentsQueryInput,
  SkipMonthDetailInput,
  UpdateInstallmentInput,
} from './installment.validation';
import {
  Installment,
  INSTALLMENT_KIND,
  INSTALLMENT_STATUS,
  IInstallmentDocument,
  InstallmentKind,
} from './installment.model';

function toDto(doc: IInstallmentDocument | Record<string, unknown>) {
  const d = doc as IInstallmentDocument;
  return {
    id: d._id.toString(),
    chitId: d.chitId.toString(),
    bidderId: d.bidderId ? d.bidderId.toString() : null,
    monthNumber: d.monthNumber,
    amount: d.amount,
    balanceAmount: d.balanceAmount ?? 0,
    status: d.status,
    kind: d.kind ?? INSTALLMENT_KIND.BIDDER_PAYMENT,
    paidAt: d.paidAt ?? null,
    note: d.note ?? null,
    skipReason: d.skipReason ?? null,
    recordedBy: d.recordedBy.toString(),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  );
}

async function loadScopedChit(
  actor: JwtPayload,
  chitId: string
): Promise<IChitDocument> {
  const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
  if (!chit || chit.status === CHIT_STATUS.DELETED) {
    throw notFound('Chit not found');
  }
  return chit;
}

function assertMonthInRange(chit: IChitDocument, monthNumber: number) {
  if (monthNumber > chit.totalMonths) {
    throw badRequest('monthNumber cannot exceed chit totalMonths');
  }
}

function assertMembers(
  chit: IChitDocument,
  bidderIds: string[],
  label = 'bidderId'
) {
  const memberSet = new Set(chit.members.map((m) => m.bidderId.toString()));
  for (const id of bidderIds) {
    if (!memberSet.has(id)) {
      throw badRequest(`${label} must be a member of this chit: ${id}`);
    }
  }
}

/** Bump completedMonths to at least monthNumber (never past totalMonths). */
async function bumpCompletedMonths(
  chit: IChitDocument,
  monthNumber: number
): Promise<void> {
  const next = Math.min(
    chit.totalMonths,
    Math.max(chit.completedMonths ?? 0, monthNumber)
  );
  if (next !== chit.completedMonths) {
    chit.completedMonths = next;
    await chit.save();
  }
}

async function createPendingUnpaid(
  chit: IChitDocument,
  monthNumber: number,
  unpaidBidderIds: string[] | undefined,
  excludeBidderId: string | undefined,
  actorSub: string,
  monthlyAmount: number
): Promise<ReturnType<typeof toDto>[]> {
  if (!unpaidBidderIds?.length) return [];

  const unique = [...new Set(unpaidBidderIds)].filter(
    (id) => id !== excludeBidderId
  );
  assertMembers(chit, unique, 'unpaidBidderIds');

  const created: ReturnType<typeof toDto>[] = [];
  for (const bidderId of unique) {
    try {
      const row = await Installment.create({
        chitId: chit._id,
        bidderId: new Types.ObjectId(bidderId),
        monthNumber,
        amount: monthlyAmount,
        balanceAmount: 0,
        status: INSTALLMENT_STATUS.PENDING,
        kind: INSTALLMENT_KIND.BIDDER_PAYMENT,
        paidAt: null,
        note: null,
        skipReason: null,
        recordedBy: new Types.ObjectId(actorSub),
      });
      created.push(toDto(row));
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        // Already has a row for this month — leave existing (paid/pending) alone.
        continue;
      }
      throw err;
    }
  }
  return created;
}

export class InstallmentService {
  async create(
    actor: JwtPayload,
    chitId: string,
    input: CreateInstallmentInput
  ) {
    const result = await this.createBidderPayment(actor, chitId, input);
    return result.entry;
  }

  async createBidderPayment(
    actor: JwtPayload,
    chitId: string,
    input: BidderPaymentMonthDetailInput
  ) {
    if (actor.role === USER_ROLES.BIDDER) {
      throw badRequest('Bidders cannot record installments');
    }

    const chit = await loadScopedChit(actor, chitId);
    assertMonthInRange(chit, input.monthNumber);
    assertMembers(chit, [input.bidderId]);

    const amount = input.amount ?? chit.monthlyInstallment;
    const balanceAmount = input.balanceAmount ?? 0;
    const status = input.status ?? INSTALLMENT_STATUS.PAID;
    const paidAt =
      status === INSTALLMENT_STATUS.PAID
        ? input.paidAt ?? new Date()
        : input.paidAt ?? null;

    let entry: ReturnType<typeof toDto>;
    try {
      const created = await Installment.create({
        chitId: chit._id,
        bidderId: new Types.ObjectId(input.bidderId),
        monthNumber: input.monthNumber,
        amount,
        balanceAmount,
        status,
        kind: INSTALLMENT_KIND.BIDDER_PAYMENT,
        paidAt,
        note: input.note?.trim() || null,
        skipReason: null,
        recordedBy: new Types.ObjectId(actor.sub),
      });
      entry = toDto(created);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        throw conflict(
          'An installment for this bidder and month already exists'
        );
      }
      throw err;
    }

    const unpaid = await createPendingUnpaid(
      chit,
      input.monthNumber,
      input.unpaidBidderIds,
      input.bidderId,
      actor.sub,
      chit.monthlyInstallment
    );

    return { entry, unpaid };
  }

  async createAgentTaken(
    actor: JwtPayload,
    chitId: string,
    input: AgentTakenMonthDetailInput
  ) {
    if (actor.role === USER_ROLES.BIDDER) {
      throw badRequest('Bidders cannot record installments');
    }

    const chit = await loadScopedChit(actor, chitId);
    assertMonthInRange(chit, input.monthNumber);

    const amount = input.amount ?? chit.monthlyInstallment;
    const balanceAmount = input.balanceAmount ?? 0;
    const paidAt = input.paidAt ?? new Date();

    let entry: ReturnType<typeof toDto>;
    try {
      const created = await Installment.create({
        chitId: chit._id,
        bidderId: null,
        monthNumber: input.monthNumber,
        amount,
        balanceAmount,
        status: INSTALLMENT_STATUS.PAID,
        kind: INSTALLMENT_KIND.AGENT_TAKEN,
        paidAt,
        note: input.note?.trim() || null,
        skipReason: null,
        recordedBy: new Types.ObjectId(actor.sub),
      });
      entry = toDto(created);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        throw conflict('Agent taken already recorded for this month');
      }
      throw err;
    }

    const unpaid = await createPendingUnpaid(
      chit,
      input.monthNumber,
      input.unpaidBidderIds,
      undefined,
      actor.sub,
      chit.monthlyInstallment
    );

    await bumpCompletedMonths(chit, input.monthNumber);

    return { entry, unpaid };
  }

  async createSkip(
    actor: JwtPayload,
    chitId: string,
    input: SkipMonthDetailInput
  ) {
    if (actor.role === USER_ROLES.BIDDER) {
      throw badRequest('Bidders cannot record installments');
    }

    const chit = await loadScopedChit(actor, chitId);
    assertMonthInRange(chit, input.monthNumber);

    const amount = input.amount ?? 0;
    const balanceAmount = input.balanceAmount ?? 0;
    const paidAt = input.skippedAt ?? new Date();

    let entry: ReturnType<typeof toDto>;
    try {
      const created = await Installment.create({
        chitId: chit._id,
        bidderId: null,
        monthNumber: input.monthNumber,
        amount,
        balanceAmount,
        status: INSTALLMENT_STATUS.WAIVED,
        kind: INSTALLMENT_KIND.MONTH_SKIP,
        paidAt,
        note: input.note?.trim() || null,
        skipReason: input.skipReason.trim(),
        recordedBy: new Types.ObjectId(actor.sub),
      });
      entry = toDto(created);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        throw conflict('This month has already been skipped');
      }
      throw err;
    }

    await bumpCompletedMonths(chit, input.monthNumber);

    return { entry };
  }

  async getById(actor: JwtPayload, chitId: string, installmentId: string) {
    const chit = await loadScopedChit(actor, chitId);
    const doc = await Installment.findOne({
      _id: new Types.ObjectId(installmentId),
      chitId: chit._id,
    });
    if (!doc) throw notFound('Installment not found');

    if (
      actor.role === USER_ROLES.BIDDER &&
      doc.bidderId?.toString() !== actor.sub
    ) {
      throw notFound('Installment not found');
    }

    return toDto(doc);
  }

  async update(
    actor: JwtPayload,
    chitId: string,
    installmentId: string,
    input: UpdateInstallmentInput
  ) {
    if (actor.role === USER_ROLES.BIDDER) {
      throw badRequest('Bidders cannot update installments');
    }

    const chit = await loadScopedChit(actor, chitId);
    const doc = await Installment.findOne({
      _id: new Types.ObjectId(installmentId),
      chitId: chit._id,
    });
    if (!doc) throw notFound('Installment not found');

    if (input.amount !== undefined) doc.amount = input.amount;
    if (input.balanceAmount !== undefined) {
      doc.balanceAmount = input.balanceAmount;
    }
    if (input.status !== undefined) doc.status = input.status;
    if (input.paidAt !== undefined) doc.paidAt = input.paidAt;
    if (input.note !== undefined) {
      doc.note = input.note?.trim() || null;
    }
    if (input.skipReason !== undefined) {
      if (doc.kind !== INSTALLMENT_KIND.MONTH_SKIP) {
        throw badRequest('skipReason is only valid for month_skip entries');
      }
      doc.skipReason = input.skipReason?.trim() || null;
    }

    if (
      input.status === INSTALLMENT_STATUS.PAID &&
      doc.paidAt == null
    ) {
      doc.paidAt = new Date();
    }

    await doc.save();
    return toDto(doc);
  }

  async list(
    actor: JwtPayload,
    chitId: string,
    query: ListInstallmentsQueryInput
  ) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit) {
      throw notFound('Chit not found');
    }

    const filter: Record<string, unknown> = {
      chitId: chit._id,
    };

    if (actor.role === USER_ROLES.BIDDER) {
      filter.bidderId = new Types.ObjectId(actor.sub);
    } else if (query.bidderId) {
      filter.bidderId = new Types.ObjectId(query.bidderId);
    }

    if (query.monthNumber !== undefined) {
      filter.monthNumber = query.monthNumber;
    }
    if (query.status) {
      filter.status = query.status;
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Installment.find(filter)
        .sort({ monthNumber: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Installment.countDocuments(filter),
    ]);

    return {
      items: items.map((doc) => toDto(doc as unknown as IInstallmentDocument)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /** Used by reports: count installments in operator scope. */
  async countInChitScope(actor: JwtPayload): Promise<number> {
    const chitIds = await Chit.find(buildChitScopeFilter(actor))
      .select('_id')
      .lean();
    if (chitIds.length === 0) return 0;
    return Installment.countDocuments({
      chitId: { $in: chitIds.map((c) => c._id) },
    });
  }
}

export const installmentService = new InstallmentService();

export type { InstallmentKind };
