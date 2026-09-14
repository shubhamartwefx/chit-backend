import { Types } from 'mongoose';
import { USER_ROLES, USER_STATUS } from '../../config/roles';
import { User } from '../users/user.model';

export class BranchStoreService {
  async listAgents(branchStoreId: string) {
    const users = await User.find({
      role: USER_ROLES.AGENT,
      createdBy: new Types.ObjectId(branchStoreId),
      status: { $ne: USER_STATUS.BLOCKED },
    })
      .select('name phone countryCode status createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .lean();

    return users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      countryCode: user.countryCode,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    }));
  }
}

export const branchStoreService = new BranchStoreService();
