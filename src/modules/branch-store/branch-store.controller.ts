import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { branchStoreService } from './branch-store.service';

export class BranchStoreController {
  async listAgents(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await branchStoreService.listAgents(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const branchStoreController = new BranchStoreController();
