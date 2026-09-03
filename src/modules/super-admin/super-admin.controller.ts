import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { superAdminService } from './super-admin.service';
import {
  CreateAgentInput,
  CreateBidderInput,
  CreateBranchStoreInput,
  CreateStaffInput,
  assignablePermissionsResponse,
} from './super-admin.validation';

export class SuperAdminController {
  async createBranchStore(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.createBranchStore(
        req.user!.sub,
        req.body as CreateBranchStoreInput
      );
      sendSuccessWithKey(
        res,
        data,
        'CREATED',
        API_MESSAGES.BRANCH_STORE_CREATED
      );
    } catch (err) {
      next(err);
    }
  }

  async listBranchStores(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listBranchStores();
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  /** @deprecated Use createBranchStore */
  async createAdmin(req: Request, res: Response, next: NextFunction) {
    return this.createBranchStore(req, res, next);
  }

  /** @deprecated Use listBranchStores */
  async listAdmins(_req: Request, res: Response, next: NextFunction) {
    return this.listBranchStores(_req, res, next);
  }

  async createAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.createAgent(
        req.user!.sub,
        req.body as CreateAgentInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.AGENT_CREATED);
    } catch (err) {
      next(err);
    }
  }

  async listAgents(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listAgents();
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async createBidder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.createBidder(
        req.user!.sub,
        req.body as CreateBidderInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.BIDDER_CREATED);
    } catch (err) {
      next(err);
    }
  }

  async listBidders(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listBidders();
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async createStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.createStaff(
        req.user!.sub,
        req.body as CreateStaffInput
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.STAFF_CREATED);
    } catch (err) {
      next(err);
    }
  }

  async listStaff(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listStaff();
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getPermissionsCatalog(_req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccessWithKey(res, assignablePermissionsResponse, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const superAdminController = new SuperAdminController();
