import { NextFunction, Request, Response } from 'express';
import { sendSuccessWithKey } from '../../common/response';
import { calendarEventService } from './calendar-event.service';
import {
  CreateCalendarEventInput,
  ListCalendarEventsQueryInput,
  UpdateCalendarEventInput,
} from './calendar-event.validation';

export class CalendarEventController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await calendarEventService.list(
        req.user!,
        req.query as unknown as ListCalendarEventsQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await calendarEventService.getById(req.user!, req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await calendarEventService.create(
        req.user!,
        req.body as CreateCalendarEventInput
      );
      sendSuccessWithKey(res, data, 'CREATED', 'Calendar event created');
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await calendarEventService.update(
        req.user!,
        req.params.id,
        req.body as UpdateCalendarEventInput
      );
      sendSuccessWithKey(res, data, 'OK', 'Calendar event updated');
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await calendarEventService.remove(req.user!, req.params.id);
      sendSuccessWithKey(res, data, 'OK', 'Calendar event deleted');
    } catch (err) {
      next(err);
    }
  }
}

export const calendarEventController = new CalendarEventController();
