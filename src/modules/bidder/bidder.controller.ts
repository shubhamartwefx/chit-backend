import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { chitService } from '../chits/chit.service';
import { JoinChitInput } from '../chits/chit.validation';

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
}

export const bidderController = new BidderController();
