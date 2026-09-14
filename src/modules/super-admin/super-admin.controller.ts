import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { superAdminService } from './super-admin.service';
import {
  CreateAgentInput,
  CreateBidderInput,
  CreateBranchStoreInput,
  CreateStaffInput,
  ListUsersQueryInput,
  UserStatusActionInput,
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

  async listBranchStores(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listBranchStores(
        req.query as ListUsersQueryInput
      );
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
  async listAdmins(req: Request, res: Response, next: NextFunction) {
    return this.listBranchStores(req, res, next);
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

  async listAgents(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listAgents(
        req.query as ListUsersQueryInput
      );
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

  async listBidders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listBidders(
        req.query as ListUsersQueryInput
      );
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

  async listStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listStaff(
        req.query as ListUsersQueryInput
      );
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

  async blockUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.blockUser(
        req.user!.sub,
        req.params.userId,
        req.body as UserStatusActionInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.USER_BLOCKED);
    } catch (err) {
      next(err);
    }
  }

  async unblockUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.unblockUser(
        req.user!.sub,
        req.params.userId,
        req.body as UserStatusActionInput
      );
      sendSuccessWithKey(res, data, 'OK', API_MESSAGES.USER_UNBLOCKED);
    } catch (err) {
      next(err);
    }
  }
}

export const superAdminController = new SuperAdminController();
