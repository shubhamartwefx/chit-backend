import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { chitService } from '../chits/chit.service';
import { JoinChitInput } from '../chits/chit.validation';
import { operatorBidderService } from '../operator-bidders/operator-bidder.service';
import { SUBSCRIPTION_PLAN_AUDIENCES } from '../subscription-plans/subscription-plan.model';
import { subscriptionPlanService } from '../subscription-plans/subscription-plan.service';

export class BidderController {
  async joinChit(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.joinAsBidder(
        req.user!,
        req.params.id,
        req.body as JoinChitInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.CHIT_JOINED);
    } catch (err) {
      next(err);
    }
  }

  /** Reports agents filed against the signed-in bidder; reporter ids stay internal. */
  async listMyReports(req: Request, res: Response, next: NextFunction) {
    try {
      const { total, items } = await operatorBidderService.listBidderReportsPlatform(
        req.user!.sub
      );
      sendSuccessWithKey(
        res,
        {
          total,
          items: items.map(({ reportedBy: _reportedBy, ...report }) => report),
        },
        'OK'
      );
    } catch (err) {
      next(err);
    }
  }

  /** Bidders only ever see bidder membership plans, whatever the query says. */
  async listSubscriptionPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionPlanService.list({
        audience: SUBSCRIPTION_PLAN_AUDIENCES.BIDDER,
      });
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const bidderController = new BidderController();
