import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { API_MESSAGES } from '../../common/status';
import { AGENT_SUBSCRIPTION_KINDS } from './agent-subscription.model';
import { agentSubscriptionService } from './agent-subscription.service';
import {
  ConfirmAgentSubscriptionInput,
  CreateAgentSubscriptionOrderInput,
} from './agent-subscription.validation';

export class AgentSubscriptionController {
  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSubscriptionService.createOrder(
        req.user!.sub,
        req.body as CreateAgentSubscriptionOrderInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.SUBSCRIPTION_ORDER_CREATED);
    } catch (err) {
      next(err);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSubscriptionService.confirm(
        req.user!.sub,
        req.body as ConfirmAgentSubscriptionInput
      );
      const message =
        data.kind === AGENT_SUBSCRIPTION_KINDS.UPGRADE
          ? API_MESSAGES.SUBSCRIPTION_UPGRADED
          : API_MESSAGES.SUBSCRIPTION_PURCHASED;
      sendSuccessWithKey(res, data, 'OK', message);
    } catch (err) {
      next(err);
    }
  }

  async listHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSubscriptionService.listHistory(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
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
