import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { transactionService } from './transaction.service';
import { ListTransactionsQueryInput } from './transaction.validation';

export class TransactionController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await transactionService.listPlatform(
        req.query as unknown as ListTransactionsQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const transactionController = new TransactionController();
