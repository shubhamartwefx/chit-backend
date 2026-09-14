import { Types } from 'mongoose';
import {
  fingerprintAadhaar,
  isValidAadhaar,
  isValidIndianPhone,
  normalizePhone,
} from '../../common/crypto';
import { badRequest, conflict, notFound } from '../../common/errors';
import { env } from '../../config/env';
import {
  AGENT_DEFAULT,
  BIDDER_DEFAULT,
  USER_ROLES,
  USER_STATUS,
  UserRole,
} from '../../config/roles';
import {
  validatePermissionsForRole,
} from '../../config/rbac';
import { tokenService } from '../auth/token.service';
import { User } from '../users/user.model';
import { UserStatusActionInput } from './super-admin.validation';
import {
  CreateAgentInput,
  CreateBidderInput,
  CreateBranchStoreInput,
  CreateStaffInput,
} from './super-admin.validation';

function assertIdentity(phone: string, aadhaarNumber: string): string {
  if (!isValidIndianPhone(phone)) {
    throw badRequest('Enter a valid 10-digit Indian mobile number');
  }
  if (!isValidAadhaar(aadhaarNumber)) {
    throw badRequest('Enter a valid 12-digit Aadhaar number');
  }
  return fingerprintAadhaar(aadhaarNumber, env.JWT_SECRET);
}

const BLOCKABLE_ROLES: readonly UserRole[] = [
  USER_ROLES.BRANCH_STORE,
  USER_ROLES.AGENT,
  USER_ROLES.BIDDER,
];

function formatUser(user: {
  _id: { toString(): string };
  name: string;
  phone: string;
  countryCode: string;
  role: UserRole;
  permissions: string[];
  status: string;
  statusReason?: string | null;
  statusChangedAt?: Date | null;
  statusChangedBy?: { toString(): string } | null;
  createdBy?: { toString(): string } | null;
  createdAt: Date;
  lastLoginAt?: Date | null;
  aadhaarLast4?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    phone: user.phone,
    countryCode: user.countryCode,
    role: user.role,
    permissions: user.permissions,
    status: user.status,
    statusReason: user.statusReason ?? null,
    statusChangedAt: user.statusChangedAt ?? null,
    statusChangedBy: user.statusChangedBy?.toString() ?? null,
    createdBy: user.createdBy?.toString() ?? null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
    aadhaarLast4: user.aadhaarLast4 ?? null,
    gender: user.gender ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
  };
}

export type ListUsersQuery = {
  q?: string;
  status?: string;
};

async function listUsersByRole(role: UserRole, query: ListUsersQuery = {}) {
  const filter: Record<string, unknown> = { role };

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
    .select('-aadhaarFingerprint -__v')
    .sort({ createdAt: -1 });

  return users.map(formatUser);
}

export class SuperAdminService {
  private async assertUniqueForRole(
    role: UserRole,
    phone: string,
    aadhaarFingerprint: string,
    label: string
  ): Promise<void> {
    const existing = await User.findOne({
      $or: [
        { phone, role },
        { aadhaarFingerprint, role },
      ],
    });

    if (existing) {
      throw conflict(`A ${label} with this phone or Aadhaar already exists`);
    }
  }

  async createBranchStore(createdById: string, input: CreateBranchStoreInput) {
    const phone = normalizePhone(input.phone);
    const aadhaarFingerprint = assertIdentity(phone, input.aadhaarNumber);

    const validation = validatePermissionsForRole(
      USER_ROLES.BRANCH_STORE,
      input.permissions
    );
    if (!validation.valid) {
      throw badRequest(validation.errors.join('; '));
    }

    await this.assertUniqueForRole(
      USER_ROLES.BRANCH_STORE,
      phone,
      aadhaarFingerprint,
      'branch store user'
    );

    const user = await User.create({
      name: input.name,
      countryCode: input.countryCode,
      phone,
      aadhaarFingerprint,
      role: USER_ROLES.BRANCH_STORE,
      permissions: input.permissions,
      status: USER_STATUS.ACTIVE,
      createdBy: createdById,
    });

    return formatUser(user);
  }

  /** @deprecated Use createBranchStore */
  async createAdmin(createdById: string, input: CreateBranchStoreInput) {
    return this.createBranchStore(createdById, input);
  }

  async listBranchStores(query: ListUsersQuery = {}) {
    return listUsersByRole(USER_ROLES.BRANCH_STORE, query);
  }

  /** @deprecated Use listBranchStores */
  async listAdmins(query: ListUsersQuery = {}) {
    return this.listBranchStores(query);
  }

  async createAgent(createdById: string, input: CreateAgentInput) {
    const phone = normalizePhone(input.phone);
    const aadhaarFingerprint = assertIdentity(phone, input.aadhaarNumber);

    await this.assertUniqueForRole(
      USER_ROLES.AGENT,
      phone,
      aadhaarFingerprint,
      'agent'
    );

    const user = await User.create({
      name: input.name,
      countryCode: input.countryCode,
      phone,
      aadhaarFingerprint,
      role: USER_ROLES.AGENT,
      permissions: [...AGENT_DEFAULT],
      status: USER_STATUS.ACTIVE,
      createdBy: createdById,
    });

    return formatUser(user);
  }

  async listAgents(query: ListUsersQuery = {}) {
    return listUsersByRole(USER_ROLES.AGENT, query);
  }

  async createBidder(createdById: string, input: CreateBidderInput) {
    const phone = normalizePhone(input.phone);
    const aadhaarFingerprint = assertIdentity(phone, input.aadhaarNumber);

    await this.assertUniqueForRole(
      USER_ROLES.BIDDER,
      phone,
      aadhaarFingerprint,
      'bidder'
    );

    const user = await User.create({
      name: input.name,
      countryCode: input.countryCode,
      phone,
      aadhaarFingerprint,
      role: USER_ROLES.BIDDER,
      permissions: [...BIDDER_DEFAULT],
      status: USER_STATUS.ACTIVE,
      createdBy: createdById,
    });

    return formatUser(user);
  }

  async listBidders(query: ListUsersQuery = {}) {
    return listUsersByRole(USER_ROLES.BIDDER, query);
  }

  async createStaff(createdById: string, input: CreateStaffInput) {
    const phone = normalizePhone(input.phone);
    const aadhaarFingerprint = assertIdentity(phone, input.aadhaarNumber);

    const validation = validatePermissionsForRole(
      USER_ROLES.SUPER_ADMIN,
      input.permissions
    );
    if (!validation.valid) {
      throw badRequest(validation.errors.join('; '));
    }

    await this.assertUniqueForRole(
      USER_ROLES.SUPER_ADMIN,
      phone,
      aadhaarFingerprint,
      'super admin staff member'
    );

    const user = await User.create({
      name: input.name,
      countryCode: input.countryCode,
      phone,
      aadhaarFingerprint,
      role: USER_ROLES.SUPER_ADMIN,
      permissions: input.permissions,
      status: USER_STATUS.ACTIVE,
      createdBy: createdById,
    });

    return formatUser(user);
  }

  async listStaff(query: ListUsersQuery = {}) {
    return listUsersByRole(USER_ROLES.SUPER_ADMIN, query);
  }

  private assertBlockableTarget(
    actorId: string,
    user: { _id: { toString(): string }; role: UserRole; status: string }
  ): void {
    if (actorId === user._id.toString()) {
      throw badRequest('You cannot block or unblock your own account');
    }
    if (user.role === USER_ROLES.SUPER_ADMIN) {
      throw badRequest('Super admin accounts cannot be blocked or unblocked');
    }
    if (!BLOCKABLE_ROLES.includes(user.role)) {
      throw badRequest('This user role cannot be blocked or unblocked');
    }
  }

  async blockUser(
    actorId: string,
    userId: string,
    input: UserStatusActionInput
  ) {
    const user = await User.findById(userId);
    if (!user) {
      throw notFound('User not found');
    }

    this.assertBlockableTarget(actorId, user);

    if (user.status === USER_STATUS.BLOCKED) {
      throw conflict('User is already blocked');
    }

    user.status = USER_STATUS.BLOCKED;
    user.statusReason = input.reason.trim();
    user.statusChangedAt = new Date();
    user.statusChangedBy = new Types.ObjectId(actorId);
    await user.save();

    const revokedSessions = await tokenService.revokeAllSessionsForUser(userId);

    return {
      ...formatUser(user),
      revokedSessions,
    };
  }

  async unblockUser(
    actorId: string,
    userId: string,
    input: UserStatusActionInput
  ) {
    const user = await User.findById(userId);
    if (!user) {
      throw notFound('User not found');
    }

    this.assertBlockableTarget(actorId, user);

    if (user.status !== USER_STATUS.BLOCKED) {
      throw conflict('User is not blocked');
    }

    user.status = USER_STATUS.ACTIVE;
    user.statusReason = input.reason.trim();
    user.statusChangedAt = new Date();
    user.statusChangedBy = new Types.ObjectId(actorId);
    await user.save();

    return formatUser(user);
  }
}

export const superAdminService = new SuperAdminService();
