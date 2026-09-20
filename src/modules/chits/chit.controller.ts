import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { chitService } from './chit.service';
import {
  AddChitMemberInput,
  CreateChitInput,
  ListChitsQueryInput,
  SummaryQueryInput,
  UpdateChitInput,
  UpdateChitMemberInput,
  ReportChitMemberInput,
} from './chit.validation';

export class ChitController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.list(
        req.user!,
        req.query as unknown as ListChitsQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.summary(
        req.user!,
        req.query as unknown as SummaryQueryInput
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.getById(req.user!, req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.create(
        req.user!,
        req.body as CreateChitInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.CHIT_CREATED);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.update(
        req.user!,
        req.params.id,
        req.body as UpdateChitInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.CHIT_UPDATED);
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.softDelete(req.user!, req.params.id);
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.CHIT_DELETED);
    } catch (err) {
      next(err);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.addMember(
        req.user!,
        req.params.id,
        req.body as AddChitMemberInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.CHIT_MEMBER_ADDED);
    } catch (err) {
      next(err);
    }
  }

  async updateMember(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.updateMember(
        req.user!,
        req.params.id,
        req.params.bidderId,
        req.body as UpdateChitMemberInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.CHIT_MEMBER_UPDATED);
    } catch (err) {
      next(err);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.removeMember(
        req.user!,
        req.params.id,
        req.params.bidderId
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.CHIT_MEMBER_REMOVED);
    } catch (err) {
      next(err);
    }
  }

  async reportMember(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await chitService.reportMember(
        req.user!,
        req.params.id,
        req.params.bidderId,
        req.body as ReportChitMemberInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.CHIT_MEMBER_REPORTED);
    } catch (err) {
      next(err);
    }
  }
}

export const chitController = new ChitController();
