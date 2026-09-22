import { Types } from 'mongoose';
import { notFound } from '../../common/errors';
import {
  DEFAULT_TUTORIAL_VIDEO,
  TUTORIAL_STATUS,
  Tutorial,
  ITutorialDocument,
} from './tutorial.model';
import {
  CreateTutorialInput,
  ListTutorialsQueryInput,
  UpdateTutorialInput,
} from './tutorial.validation';

function toDto(doc: ITutorialDocument) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    category: doc.category,
    content: doc.content,
    video: doc.video,
    sortOrder: doc.sortOrder,
    status: doc.status,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function loadActive(id: string): Promise<ITutorialDocument> {
  if (!Types.ObjectId.isValid(id)) throw notFound('Tutorial not found');
  const doc = await Tutorial.findOne({
    _id: new Types.ObjectId(id),
    status: { $ne: TUTORIAL_STATUS.DELETED },
  });
  if (!doc) throw notFound('Tutorial not found');
  return doc;
}

function normalizeYoutubeEmbed(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_TUTORIAL_VIDEO;
  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i
  );
  if (watchMatch?.[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }
  return trimmed;
}

export class TutorialService {
  async list(query: ListTutorialsQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const filter: Record<string, unknown> = {
      status: { $ne: TUTORIAL_STATUS.DELETED },
    };
    if (query.category?.trim()) {
      filter.category = query.category.trim();
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } },
      ];
    }

    const [total, rows] = await Promise.all([
      Tutorial.countDocuments(filter),
      Tutorial.find(filter)
        .sort({ sortOrder: 1, createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      items: rows.map(toDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getById(id: string) {
    const doc = await loadActive(id);
    return toDto(doc);
  }

  async create(actorId: string, input: CreateTutorialInput) {
    const doc = await Tutorial.create({
      title: input.title.trim(),
      category: input.category.trim(),
      content: input.content?.trim() || 'No description added yet.',
      video: normalizeYoutubeEmbed(input.video || DEFAULT_TUTORIAL_VIDEO),
      sortOrder: input.sortOrder ?? 0,
      status: TUTORIAL_STATUS.ACTIVE,
      createdBy: new Types.ObjectId(actorId),
    });
    return toDto(doc);
  }

  async update(id: string, input: UpdateTutorialInput) {
    const doc = await loadActive(id);
    if (input.title !== undefined) doc.title = input.title.trim();
    if (input.category !== undefined) doc.category = input.category.trim();
    if (input.content !== undefined) {
      doc.content = input.content.trim() || 'No description added yet.';
    }
    if (input.video !== undefined) {
      doc.video = normalizeYoutubeEmbed(input.video || DEFAULT_TUTORIAL_VIDEO);
    }
    if (input.sortOrder !== undefined) doc.sortOrder = input.sortOrder;
    await doc.save();
    return toDto(doc);
  }

  async remove(id: string) {
    const doc = await loadActive(id);
    doc.status = TUTORIAL_STATUS.DELETED;
    await doc.save();
    return { id: doc._id.toString(), deleted: true };
  }
}

export const tutorialService = new TutorialService();
