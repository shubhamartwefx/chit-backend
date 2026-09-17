import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { auctionService } from './auction.service';
import {
  CloseAuctionRoundInput,
  CreateAuctionRoundInput,
  ListAuctionRoundsQueryInput,
  PlaceBidInput,
} from './auction.validation';

export class AuctionController {
  async createRound(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await auctionService.createRound(
        req.user!,
        req.params.id,
        req.body as CreateAuctionRoundInput
      );
      sendSuccessWithKey(
        res,
        data,
        'CREATED',
        API_MESSAGES.AUCTION_ROUND_CREATED
      );
    } catch (err) {
      next(err);
    }
  }

  async listRounds(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await auctionService.listRounds(
        req.user!,
        req.params.id,
        req.query as unknown as ListAuctionRoundsQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getRound(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await auctionService.getRound(
        req.user!,
        req.params.id,
        req.params.roundId
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async placeBid(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await auctionService.placeBid(
        req.user!,
        req.params.id,
        req.params.roundId,
        req.body as PlaceBidInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.BID_PLACED);
    } catch (err) {
      next(err);
    }
  }

  async closeRound(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await auctionService.closeRound(
        req.user!,
        req.params.id,
        req.params.roundId,
        (req.body || {}) as CloseAuctionRoundInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.AUCTION_ROUND_CLOSED);
    } catch (err) {
      next(err);
    }
  }
}

export const auctionController = new AuctionController();
