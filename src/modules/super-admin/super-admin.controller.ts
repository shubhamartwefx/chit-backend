import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccessWithKey } from '../../common/response';
import { superAdminService } from './super-admin.service';
import {
  AssignBidderAgentInput,
  CreateAgentInput,
  CreateBidderInput,
  CreateBranchStoreInput,
  CreateStaffInput,
  ListUsersQueryInput,
  UpdateStaffPermissionsInput,
  UpdateUserProfileInput,
  UserStatusActionInput,
  assignablePermissionsResponse,
} from './super-admin.validation';
import { ListOperatorReportsQueryInput } from '../operator-bidders/operator-bidder.validation';

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

  async getAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.getAgentById(req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async updateAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.updateAgentProfile(
        req.params.id,
        req.body as UpdateUserProfileInput
      );
      sendSuccessWithKey(res, data, 'OK', 'Agent profile updated');
    } catch (err) {
      next(err);
    }
  }

  async updateBidder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.updateBidderProfile(
        req.params.id,
        req.body as UpdateUserProfileInput
      );
      sendSuccessWithKey(res, data, 'OK', 'Bidder profile updated');
    } catch (err) {
      next(err);
    }
  }

  async getBranchStore(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.getBranchStoreById(req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async getBidder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.getBidderById(req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async listBidderReports(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listBidderReports(req.params.id);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async listReports(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.listReports(
        req.query as unknown as ListOperatorReportsQueryInput
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

  async assignBidderToAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as AssignBidderAgentInput;
      const data = await superAdminService.assignBidderToAgent(
        req.params.id,
        body.agentId
      );
      sendSuccessWithKey(res, data, 'OK', 'Bidder assigned to agent');
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

  async updateStaffPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.updateStaffPermissions(
        req.user!.sub,
        req.params.userId,
        req.body as UpdateStaffPermissionsInput
      );
      sendSuccessWithKey(
        res,
        data,
        'OK',
        API_MESSAGES.STAFF_PERMISSIONS_UPDATED
      );
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
