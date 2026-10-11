import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { API_MESSAGES } from '../../common/status';
import { sensitiveDataService } from './sensitive-data.service';
import { RevealSensitiveFieldInput } from './sensitive-data.validation';

export class SensitiveDataController {
  async reveal(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    try {
      const body = req.body as RevealSensitiveFieldInput;
      const data = await sensitiveDataService.reveal({
        actorId: req.user!.sub,
        targetUserId: req.params.userId,
        field: body.field,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      });
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.SENSITIVE_DATA_REVEALED);
    } catch (err) {
      next(err);
    }
  }
}

export const sensitiveDataController = new SensitiveDataController();
