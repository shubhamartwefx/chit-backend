import { Types } from 'mongoose';
import { badRequest, notFound } from '../../common/errors';
import { JwtPayload } from '../../types/express';
import { Chit, CHIT_STATUS } from '../chits/chit.model';
import { buildScopedChitByIdFilter } from '../chits/chit.scope';
import {
  CALENDAR_EVENT_OWNER_TYPES,
  CALENDAR_EVENT_STATUS,
  CalendarEvent,
  ICalendarEventDocument,
} from './calendar-event.model';
import {
  CreateCalendarEventInput,
  ListCalendarEventsQueryInput,
  UpdateCalendarEventInput,
} from './calendar-event.validation';

type EventWithChit = ICalendarEventDocument & {
  chitId: Types.ObjectId | { _id: Types.ObjectId; chitCode?: string };
};

function toDto(doc: EventWithChit) {
  const chit =
    doc.chitId && typeof doc.chitId === 'object' && '_id' in doc.chitId
      ? (doc.chitId as { _id: Types.ObjectId; chitCode?: string })
      : null;
  const chitIdStr = chit
    ? chit._id.toString()
    : (doc.chitId as Types.ObjectId).toString();

  return {
    id: doc._id.toString(),
    title: doc.title,
    chitId: chitIdStr,
    chitCode: chit?.chitCode ?? '',
    start: doc.start.toISOString(),
    end: doc.end.toISOString(),
    color: doc.color,
    status: doc.status,
    ownerType: doc.ownerType,
    ownerId: doc.ownerId.toString(),
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function resolveOwnedChit(actor: JwtPayload, chitId: string) {
  if (!Types.ObjectId.isValid(chitId)) {
    throw badRequest('Invalid chitId');
  }
  const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId)).select(
    '_id chitCode status agentId'
  );
  if (!chit || chit.status === CHIT_STATUS.DELETED) {
    throw notFound('Chit not found');
  }
  return chit;
}

function ownerFilter(actor: JwtPayload) {
  return {
    ownerType: CALENDAR_EVENT_OWNER_TYPES.AGENT,
    ownerId: new Types.ObjectId(actor.sub),
    status: { $ne: CALENDAR_EVENT_STATUS.DELETED },
  };
}

async function loadOwnedActive(
  actor: JwtPayload,
  id: string
): Promise<ICalendarEventDocument> {
  if (!Types.ObjectId.isValid(id)) throw notFound('Calendar event not found');
  const doc = await CalendarEvent.findOne({
    _id: new Types.ObjectId(id),
    ...ownerFilter(actor),
  });
  if (!doc) throw notFound('Calendar event not found');
  return doc;
}

export class CalendarEventService {
  async list(actor: JwtPayload, query: ListCalendarEventsQueryInput) {
    const filter: Record<string, unknown> = { ...ownerFilter(actor) };

    if (query.from || query.to) {
      // Overlap: event.start < to AND event.end > from
      if (query.from && query.to) {
        filter.start = { $lt: query.to };
        filter.end = { $gt: query.from };
      } else if (query.from) {
        filter.end = { $gt: query.from };
      } else if (query.to) {
        filter.start = { $lt: query.to };
      }
    }

    const rows = await CalendarEvent.find(filter)
      .populate('chitId', 'chitCode')
      .sort({ start: 1 });

    return {
      items: rows.map((doc) => toDto(doc as EventWithChit)),
    };
  }

  async getById(actor: JwtPayload, id: string) {
    const doc = await loadOwnedActive(actor, id);
    await doc.populate('chitId', 'chitCode');
    return toDto(doc as EventWithChit);
  }

  async create(actor: JwtPayload, input: CreateCalendarEventInput) {
    const chit = await resolveOwnedChit(actor, input.chitId);
    const doc = await CalendarEvent.create({
      ownerType: CALENDAR_EVENT_OWNER_TYPES.AGENT,
      ownerId: new Types.ObjectId(actor.sub),
      chitId: chit._id,
      title: input.title.trim(),
      start: input.start,
      end: input.end,
      color: input.color,
      status: CALENDAR_EVENT_STATUS.ACTIVE,
      createdBy: new Types.ObjectId(actor.sub),
    });
    await doc.populate('chitId', 'chitCode');
    return toDto(doc as EventWithChit);
  }

  async update(
    actor: JwtPayload,
    id: string,
    input: UpdateCalendarEventInput
  ) {
    const doc = await loadOwnedActive(actor, id);

    if (input.chitId !== undefined) {
      const chit = await resolveOwnedChit(actor, input.chitId);
      doc.chitId = chit._id;
    }
    if (input.title !== undefined) doc.title = input.title.trim();
    if (input.start !== undefined) doc.start = input.start;
    if (input.end !== undefined) doc.end = input.end;
    if (input.color !== undefined) doc.color = input.color;

    const nextStart = input.start ?? doc.start;
    const nextEnd = input.end ?? doc.end;
    if (nextEnd.getTime() <= nextStart.getTime()) {
      throw badRequest('end must be after start');
    }

    await doc.save();
    await doc.populate('chitId', 'chitCode');
    return toDto(doc as EventWithChit);
  }

  async remove(actor: JwtPayload, id: string) {
    const doc = await loadOwnedActive(actor, id);
    doc.status = CALENDAR_EVENT_STATUS.DELETED;
    await doc.save();
    return { id: doc._id.toString(), deleted: true };
  }
}

export const calendarEventService = new CalendarEventService();
