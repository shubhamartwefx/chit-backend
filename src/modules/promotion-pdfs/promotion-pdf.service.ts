import { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../../common/errors';
import {
  MAX_PROMOTION_PDFS_PER_AGENT,
  PROMOTION_PDF_STATUS,
  PromotionPdf,
  IPromotionPdfDocument,
} from './promotion-pdf.model';
import {
  CreatePromotionPdfInput,
  ListPromotionPdfsQueryInput,
  UpdatePromotionPdfInput,
} from './promotion-pdf.validation';

function generatePdfCode(): string {
  const timePart = Date.now().toString().slice(-6);
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  return `PDF-${timePart}${randomPart}`;
}

async function createUniquePdfCode(maxAttempts = 8): Promise<string> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = generatePdfCode();
    const exists = await PromotionPdf.exists({ pdfCode: code });
    if (!exists) return code;
  }
  throw badRequest('Unable to generate a unique PDF code. Please retry.');
}

function toDto(doc: IPromotionPdfDocument) {
  const year = doc.startDate
    ? new Date(doc.startDate).getFullYear()
    : new Date().getFullYear();
  const amountLabel =
    Number.isInteger(doc.amountInLakhs) || doc.amountInLakhs % 1 === 0
      ? String(doc.amountInLakhs)
      : doc.amountInLakhs.toFixed(2).replace(/\.?0+$/, '');

  return {
    id: doc._id.toString(),
    pdfCode: doc.pdfCode,
    type: doc.type,
    amountInLakhs: doc.amountInLakhs,
    placeAndTime: doc.placeAndTime,
    govtBettingAmount: doc.govtBettingAmount,
    monthlyInstallment: doc.monthlyInstallment,
    numberOfBidders: doc.numberOfBidders,
    totalMonths: doc.totalMonths,
    govtBettingUnits: doc.govtBettingUnits,
    paymentType: doc.paymentType,
    startDate: doc.startDate,
    lastDayToPay: doc.lastDayToPay,
    agentId: doc.agentId.toString(),
    createdBy: doc.createdBy.toString(),
    status: doc.status,
    title: `${amountLabel} Lakh Chiti ${year}`,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function loadOwnedActive(
  agentId: string,
  pdfId: string
): Promise<IPromotionPdfDocument> {
  if (!Types.ObjectId.isValid(pdfId)) {
    throw notFound('Promotion PDF not found');
  }
  const doc = await PromotionPdf.findOne({
    _id: new Types.ObjectId(pdfId),
    agentId: new Types.ObjectId(agentId),
    status: { $ne: PROMOTION_PDF_STATUS.DELETED },
  });
  if (!doc) throw notFound('Promotion PDF not found');
  return doc;
}

export class PromotionPdfService {
  async list(agentId: string, query: ListPromotionPdfsQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const filter: Record<string, unknown> = {
      agentId: new Types.ObjectId(agentId),
      status: { $ne: PROMOTION_PDF_STATUS.DELETED },
    };
    if (query.q?.trim()) {
      const q = query.q.trim();
      filter.$or = [
        { pdfCode: { $regex: q, $options: 'i' } },
        { placeAndTime: { $regex: q, $options: 'i' } },
      ];
    }

    const [total, rows] = await Promise.all([
      PromotionPdf.countDocuments(filter),
      PromotionPdf.find(filter)
        .sort({ createdAt: -1 })
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
      maxAllowed: MAX_PROMOTION_PDFS_PER_AGENT,
      remaining: Math.max(0, MAX_PROMOTION_PDFS_PER_AGENT - total),
    };
  }

  async getById(agentId: string, pdfId: string) {
    const doc = await loadOwnedActive(agentId, pdfId);
    return toDto(doc);
  }

  async create(agentId: string, input: CreatePromotionPdfInput) {
    const agentOid = new Types.ObjectId(agentId);
    const activeCount = await PromotionPdf.countDocuments({
      agentId: agentOid,
      status: { $ne: PROMOTION_PDF_STATUS.DELETED },
    });
    if (activeCount >= MAX_PROMOTION_PDFS_PER_AGENT) {
      throw conflict(
        `You can create a maximum of ${MAX_PROMOTION_PDFS_PER_AGENT} promotion PDFs. Delete an existing one to create another.`
      );
    }

    if (input.lastDayToPay < input.startDate) {
      throw badRequest('Last day to pay must be on or after the start date');
    }

    const pdfCode = await createUniquePdfCode();
    const doc = await PromotionPdf.create({
      pdfCode,
      type: input.type,
      amountInLakhs: input.amountInLakhs,
      placeAndTime: input.placeAndTime,
      govtBettingAmount: input.govtBettingAmount,
      monthlyInstallment: input.monthlyInstallment,
      numberOfBidders: input.numberOfBidders,
      totalMonths: input.totalMonths,
      govtBettingUnits: input.govtBettingUnits,
      paymentType: input.paymentType,
      startDate: input.startDate,
      lastDayToPay: input.lastDayToPay,
      agentId: agentOid,
      createdBy: agentOid,
      status: PROMOTION_PDF_STATUS.ACTIVE,
    });

    return toDto(doc);
  }

  async update(
    agentId: string,
    pdfId: string,
    input: UpdatePromotionPdfInput
  ) {
    const doc = await loadOwnedActive(agentId, pdfId);

    if (input.type !== undefined) doc.type = input.type;
    if (input.amountInLakhs !== undefined) doc.amountInLakhs = input.amountInLakhs;
    if (input.placeAndTime !== undefined) doc.placeAndTime = input.placeAndTime;
    if (input.govtBettingAmount !== undefined) {
      doc.govtBettingAmount = input.govtBettingAmount;
    }
    if (input.monthlyInstallment !== undefined) {
      doc.monthlyInstallment = input.monthlyInstallment;
    }
    if (input.numberOfBidders !== undefined) {
      doc.numberOfBidders = input.numberOfBidders;
    }
    if (input.totalMonths !== undefined) doc.totalMonths = input.totalMonths;
    if (input.govtBettingUnits !== undefined) {
      doc.govtBettingUnits = input.govtBettingUnits;
    }
    if (input.paymentType !== undefined) doc.paymentType = input.paymentType;
    if (input.startDate !== undefined) doc.startDate = input.startDate;
    if (input.lastDayToPay !== undefined) doc.lastDayToPay = input.lastDayToPay;

    const start = doc.startDate;
    const last = doc.lastDayToPay;
    if (last < start) {
      throw badRequest('Last day to pay must be on or after the start date');
    }

    await doc.save();
    return toDto(doc);
  }

  async remove(agentId: string, pdfId: string) {
    const doc = await loadOwnedActive(agentId, pdfId);
    doc.status = PROMOTION_PDF_STATUS.DELETED;
    await doc.save();
    return { id: doc._id.toString(), deleted: true };
  }
}

export const promotionPdfService = new PromotionPdfService();
