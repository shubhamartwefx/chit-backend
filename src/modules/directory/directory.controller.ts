import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { directoryService } from './directory.service';
import { DirectorySearchQueryInput } from './directory.validation';

export class DirectoryController {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await directoryService.search(
        req.user!,
        req.query as unknown as DirectorySearchQueryInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.DIRECTORY_SEARCH_OK);
    } catch (err) {
      next(err);
    }
  }

  async listBidderReports(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await directoryService.listBidderReports(
        req.user!,
        req.params.id
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.DIRECTORY_REPORTS_OK);
    } catch (err) {
      next(err);
    }
  }
}

export const directoryController = new DirectoryController();
