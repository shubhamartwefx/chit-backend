import { Types } from 'mongoose';
import { USER_ROLES } from '../../config/roles';
import { User } from '../users/user.model';
import { operatorBidderService } from '../operator-bidders/operator-bidder.service';
import {
  CreateOperatorBidderInput,
  ListOperatorAgentsQueryInput,
  ListOperatorBiddersQueryInput,
} from '../operator-bidders/operator-bidder.validation';

export class BranchStoreService {
  async listAgents(
    branchStoreId: string,
    query: ListOperatorAgentsQueryInput = {}
  ) {
    const filter: Record<string, unknown> = {
      role: USER_ROLES.AGENT,
      createdBy: new Types.ObjectId(branchStoreId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q.replace(/\D/g, ''), $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('name phone countryCode status createdAt lastLoginAt statusReason')
      .sort({ createdAt: -1 })
      .lean();

    return users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      countryCode: user.countryCode,
      status: user.status,
      statusReason: user.statusReason ?? null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    }));
  }

  async listBidders(branchStoreId: string, query: ListOperatorBiddersQueryInput) {
    return operatorBidderService.list(
      branchStoreId,
      USER_ROLES.BRANCH_STORE,
      query
    );
  }

  async createBidder(
    branchStoreId: string,
    input: CreateOperatorBidderInput
  ) {
    return operatorBidderService.create(branchStoreId, input);
  }
}

export const branchStoreService = new BranchStoreService();
