import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { subscriptionPlanService } from './subscription-plan.service';
import {
  BulkUpsertSubscriptionPlansInput,
  CreateSubscriptionPlanInput,
  ListSubscriptionPlansQueryInput,
  UpdateSubscriptionPlanInput,
} from './subscription-plan.validation';

export class SubscriptionPlanController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionPlanService.list(
        req.query as unknown as ListSubscriptionPlansQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionPlanService.getById(req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionPlanService.create(
        req.user!.sub,
        req.body as CreateSubscriptionPlanInput
      );
      sendSuccessWithKey(res, data, 'CREATED', 'Subscription plan created');
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionPlanService.update(
        req.params.id,
        req.body as UpdateSubscriptionPlanInput
      );
      sendSuccessWithKey(res, data, 'OK', 'Subscription plan updated');
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionPlanService.remove(req.params.id);
      sendSuccessWithKey(res, data, 'OK', 'Subscription plan deleted');
    } catch (err) {
      next(err);
    }
  }

  async bulkUpsert(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionPlanService.bulkUpsert(
        req.user!.sub,
        req.body as BulkUpsertSubscriptionPlansInput
      );
      sendSuccessWithKey(res, data, 'OK', 'Subscription plans replaced');
    } catch (err) {
      next(err);
    }
  }
}

export const subscriptionPlanController = new SubscriptionPlanController();
