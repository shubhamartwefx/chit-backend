import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { reportsService } from './reports.service';

export class ReportsController {
  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportsService.overview(req.user!);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const reportsController = new ReportsController();
