import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { API_MESSAGES } from '../../common/status';
import { agentSubscriptionService } from './agent-subscription.service';
import { PurchaseAgentSubscriptionInput } from './agent-subscription.validation';

export class AgentSubscriptionController {
  async purchase(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSubscriptionService.purchase(
        req.user!.sub,
        req.body as PurchaseAgentSubscriptionInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.SUBSCRIPTION_PURCHASED);
    } catch (err) {
      next(err);
    }
  }

  async getCurrent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSubscriptionService.getCurrent(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const agentSubscriptionController = new AgentSubscriptionController();
