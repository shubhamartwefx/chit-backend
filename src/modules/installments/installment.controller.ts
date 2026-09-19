import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { installmentService } from './installment.service';
import {
  AgentTakenMonthDetailInput,
  BidderPaymentMonthDetailInput,
  CreateInstallmentInput,
  ListInstallmentsQueryInput,
  SkipMonthDetailInput,
  UpdateInstallmentInput,
} from './installment.validation';

export class InstallmentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await installmentService.create(
        req.user!,
        req.params.id,
        req.body as CreateInstallmentInput
      );
      sendSuccessWithKey(
        res,
        data,
        'CREATED',
        API_MESSAGES.INSTALLMENT_RECORDED
      );
    } catch (err) {
      next(err);
    }
  }

  async createBidderPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await installmentService.createBidderPayment(
        req.user!,
        req.params.id,
        req.body as BidderPaymentMonthDetailInput
      );
      sendSuccessWithKey(
        res,
        data,
        'CREATED',
        API_MESSAGES.MONTH_DETAIL_RECORDED
      );
    } catch (err) {
      next(err);
    }
  }

  async createAgentTaken(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await installmentService.createAgentTaken(
        req.user!,
        req.params.id,
        req.body as AgentTakenMonthDetailInput
      );
      sendSuccessWithKey(
        res,
        data,
        'CREATED',
        API_MESSAGES.AGENT_TAKEN_RECORDED
      );
    } catch (err) {
      next(err);
    }
  }

  async createSkip(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await installmentService.createSkip(
        req.user!,
        req.params.id,
        req.body as SkipMonthDetailInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.MONTH_SKIPPED);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await installmentService.getById(
        req.user!,
        req.params.id,
        req.params.installmentId
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await installmentService.update(
        req.user!,
        req.params.id,
        req.params.installmentId,
        req.body as UpdateInstallmentInput
      );
      sendSuccessWithKey(
        res,
        data,
        'OK',
        API_MESSAGES.INSTALLMENT_UPDATED
      );
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await installmentService.list(
        req.user!,
        req.params.id,
        req.query as unknown as ListInstallmentsQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const installmentController = new InstallmentController();
