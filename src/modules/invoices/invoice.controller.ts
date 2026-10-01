import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { invoiceService } from './invoice.service';
import { ListInvoicesQueryInput } from './invoice.validation';

export class InvoiceController {
  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await invoiceService.listForUser(
        req.user!.sub,
        req.query as unknown as ListInvoicesQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await invoiceService.getForUser(req.user!.sub, req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const invoiceController = new InvoiceController();
