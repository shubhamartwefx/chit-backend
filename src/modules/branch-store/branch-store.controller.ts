import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { branchStoreService } from './branch-store.service';
import {
  CreateOperatorBidderInput,
  ListOperatorAgentsQueryInput,
  ListOperatorBiddersQueryInput,
} from '../operator-bidders/operator-bidder.validation';

export class BranchStoreController {
  async listAgents(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await branchStoreService.listAgents(
        req.user!.sub,
        req.query as unknown as ListOperatorAgentsQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async listBidders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await branchStoreService.listBidders(
        req.user!.sub,
        req.query as unknown as ListOperatorBiddersQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async createBidder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await branchStoreService.createBidder(
        req.user!.sub,
        req.body as CreateOperatorBidderInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.BIDDER_CREATED);
    } catch (err) {
      next(err);
    }
  }
}

export const branchStoreController = new BranchStoreController();
