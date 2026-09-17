import { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../../common/errors';
import { USER_ROLES } from '../../config/roles';
import { JwtPayload } from '../../types/express';
import { Chit, CHIT_STATUS } from '../chits/chit.model';
import {
  buildChitScopeFilter,
  buildScopedChitByIdFilter,
} from '../chits/chit.scope';
import {
  CreateInstallmentInput,
  ListInstallmentsQueryInput,
} from './installment.validation';
import {
  Installment,
  INSTALLMENT_STATUS,
  IInstallmentDocument,
} from './installment.model';

function toDto(doc: IInstallmentDocument | Record<string, unknown>) {
  const d = doc as IInstallmentDocument;
  return {
    id: d._id.toString(),
    chitId: d.chitId.toString(),
    bidderId: d.bidderId.toString(),
    monthNumber: d.monthNumber,
    amount: d.amount,
    status: d.status,
    paidAt: d.paidAt ?? null,
    note: d.note ?? null,
    recordedBy: d.recordedBy.toString(),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export class InstallmentService {
  async create(
    actor: JwtPayload,
    chitId: string,
    input: CreateInstallmentInput
  ) {
    if (actor.role === USER_ROLES.BIDDER) {
      throw badRequest('Bidders cannot record installments');
    }

    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit || chit.status === CHIT_STATUS.DELETED) {
      throw notFound('Chit not found');
    }

    if (input.monthNumber > chit.totalMonths) {
      throw badRequest('monthNumber cannot exceed chit totalMonths');
    }

    const isMember = chit.members.some(
      (m) => m.bidderId.toString() === input.bidderId
    );
    if (!isMember) {
      throw badRequest('bidderId must be a member of this chit');
    }

    const amount = input.amount ?? chit.monthlyInstallment;
    const status = input.status ?? INSTALLMENT_STATUS.PAID;
    const paidAt =
      status === INSTALLMENT_STATUS.PAID
        ? input.paidAt ?? new Date()
        : input.paidAt ?? null;

    try {
      const created = await Installment.create({
        chitId: chit._id,
        bidderId: new Types.ObjectId(input.bidderId),
        monthNumber: input.monthNumber,
        amount,
        status,
        paidAt,
        note: input.note?.trim() || null,
        recordedBy: new Types.ObjectId(actor.sub),
      });
      return toDto(created);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: number }).code === 11000
      ) {
        throw conflict(
          'An installment for this bidder and month already exists'
        );
      }
      throw err;
    }
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
