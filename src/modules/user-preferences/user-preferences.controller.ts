import { NextFunction, Request, Response } from 'express';
import { sendSuccess, sendSuccessWithKey } from '../../common/response';
import { API_MESSAGES } from '../../common/status';
import { userPreferencesService } from './user-preferences.service';
import type { UpdatePreferencesInput } from './user-preferences.validation';

export class UserPreferencesController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userPreferencesService.getPreferences(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userPreferencesService.updatePreferences(
        req.user!.sub,
        req.body as UpdatePreferencesInput
      );
      sendSuccess(res, data, API_MESSAGES.PREFERENCES_UPDATED);
    } catch (err) {
      next(err);
    }
  }
}

export const userPreferencesController = new UserPreferencesController();
