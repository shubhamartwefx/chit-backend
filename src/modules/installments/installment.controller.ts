import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { installmentService } from './installment.service';
import {
  CreateInstallmentInput,
  ListInstallmentsQueryInput,
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
