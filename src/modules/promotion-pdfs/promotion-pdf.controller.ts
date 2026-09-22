import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { promotionPdfService } from './promotion-pdf.service';
import {
  CreatePromotionPdfInput,
  ListPromotionPdfsQueryInput,
  UpdatePromotionPdfInput,
} from './promotion-pdf.validation';

export class PromotionPdfController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await promotionPdfService.list(
        req.user!.sub,
        req.query as unknown as ListPromotionPdfsQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await promotionPdfService.getById(
        req.user!.sub,
        req.params.id
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await promotionPdfService.create(
        req.user!.sub,
        req.body as CreatePromotionPdfInput
      );
      sendSuccessWithKey(res, data, 'CREATED', 'Promotion PDF created');
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await promotionPdfService.update(
        req.user!.sub,
        req.params.id,
        req.body as UpdatePromotionPdfInput
      );
      sendSuccessWithKey(res, data, 'OK', 'Promotion PDF updated');
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await promotionPdfService.remove(
        req.user!.sub,
        req.params.id
      );
      sendSuccessWithKey(res, data, 'OK', 'Promotion PDF deleted');
    } catch (err) {
      next(err);
    }
  }
}

export const promotionPdfController = new PromotionPdfController();
