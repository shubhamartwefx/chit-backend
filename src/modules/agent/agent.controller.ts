import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { agentService } from './agent.service';
import {
  CreateOperatorBidderInput,
  ListOperatorBiddersQueryInput,
  OperatorBidderStatusActionInput,
} from '../operator-bidders/operator-bidder.validation';

export class AgentController {
  async listBidders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentService.listBidders(
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
      const data = await agentService.createBidder(
        req.user!.sub,
        req.body as CreateOperatorBidderInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.BIDDER_CREATED);
    } catch (err) {
      next(err);
    }
  }

  async blockBidder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentService.blockBidder(
        req.user!.sub,
        req.params.id,
        req.body as OperatorBidderStatusActionInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.USER_BLOCKED);
    } catch (err) {
      next(err);
    }
  }

  async unblockBidder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentService.unblockBidder(
        req.user!.sub,
        req.params.id,
        req.body as OperatorBidderStatusActionInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.USER_UNBLOCKED);
    } catch (err) {
      next(err);
    }
  }
}

export const agentController = new AgentController();
