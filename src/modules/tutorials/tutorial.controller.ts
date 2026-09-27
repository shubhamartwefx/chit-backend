import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { tutorialService } from './tutorial.service';
import {
  CreateTutorialInput,
  ListTutorialsQueryInput,
  UpdateTutorialInput,
} from './tutorial.validation';

export class TutorialController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tutorialService.list(
        req.query as unknown as ListTutorialsQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tutorialService.getById(req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tutorialService.create(
        req.user!.sub,
        req.body as CreateTutorialInput
      );
      sendSuccessWithKey(res, data, 'CREATED', 'Tutorial created');
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tutorialService.update(
        req.params.id,
        req.body as UpdateTutorialInput
      );
      sendSuccessWithKey(res, data, 'OK', 'Tutorial updated');
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tutorialService.remove(req.params.id);
      sendSuccessWithKey(res, data, 'OK', 'Tutorial deleted');
    } catch (err) {
      next(err);
    }
  }
}

export const tutorialController = new TutorialController();
