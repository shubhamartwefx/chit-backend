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
import { Chit, CHIT_STATUS } from '../chits/chit.model';
import { tokenService } from '../auth/token.service';
import { IUserDocument, User } from '../users/user.model';
import {
  UpdateUserProfileInput,
  UserStatusActionInput,
} from './super-admin.validation';
import {
  CreateAgentInput,
  CreateBidderInput,
  CreateBranchStoreInput,
  CreateStaffInput,
} from './super-admin.validation';
import { operatorBidderService } from '../operator-bidders/operator-bidder.service';
import { ListOperatorReportsQueryInput } from '../operator-bidders/operator-bidder.validation';

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

function formatAddress(
  address:
    | {
        street?: string;
        city?: string;
        state?: string;
        pincode?: string;
        country?: string;
      }
    | null
    | undefined
) {
  if (!address) return null;
  return {
    street: address.street ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    pincode: address.pincode ?? '',
    country: address.country ?? '',
  };
}

function isAadhaarVerified(user: {
  aadhaarVerifiedAt?: Date | null;
  verificationMethod?: string | null;
}): boolean {
  return Boolean(
    user.aadhaarVerifiedAt ||
      user.verificationMethod === 'admin_provisioned' ||
      user.verificationMethod === 'digilocker'
  );
}

async function loadNominees(
  links: Array<{ userId: Types.ObjectId; linkedAt: Date }> | undefined
) {
  const list = links ?? [];
  if (list.length === 0) return [];
  const users = await User.find({ _id: { $in: list.map((l) => l.userId) } })
    .select('name role')
    .lean();
  return list.map((link) => {
    const nominee = users.find((u) => u._id.toString() === link.userId.toString());
    return {
      id: link.userId.toString(),
      name: nominee?.name ?? null,
      role: (nominee?.role as UserRole | undefined) ?? null,
      linkedAt: link.linkedAt,
    };
  });
}

async function loadOperatorChits(filter: Record<string, unknown>) {
  const chits = await Chit.find({ ...filter, status: { $ne: CHIT_STATUS.DELETED } })
    .select('_id chitCode amountInLakhs members.numberOfTickets')
    .sort({ createdAt: 1 })
    .lean();
  return chits.map((c) => ({
    id: c._id.toString(),
    chitCode: c.chitCode,
    amountInLakhs: c.amountInLakhs,
    bidderCount: (c.members ?? []).length,
    ticketCount: (c.members ?? []).reduce(
      (sum, m) => sum + (m.numberOfTickets ?? 1),
      0
    ),
  }));
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

  return users;
}

async function resolveCreatorMeta(
  createdByIds: string[]
): Promise<Map<string, { name: string; role: UserRole }>> {
  const map = new Map<string, { name: string; role: UserRole }>();
  const unique = [...new Set(createdByIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const creators = await User.find({
    _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
  })
    .select('name role')
    .lean();

  for (const creator of creators) {
    map.set(creator._id.toString(), {
      name: creator.name,
      role: creator.role as UserRole,
    });
  }
  return map;
}

async function loadAgentListStats(
  agentIds: string[]
): Promise<Map<string, { chitCount: number; reportCount: number }>> {
  const map = new Map<string, { chitCount: number; reportCount: number }>();
  for (const id of agentIds) {
    map.set(id, { chitCount: 0, reportCount: 0 });
  }
  if (agentIds.length === 0) return map;

  const chits = await Chit.find({
    agentId: { $in: agentIds.map((id) => new Types.ObjectId(id)) },
    status: { $ne: CHIT_STATUS.DELETED },
  })
    .select('agentId members.reports')
    .lean();

  for (const chit of chits) {
    const agentId = chit.agentId?.toString();
    if (!agentId) continue;
    const entry = map.get(agentId);
    if (!entry) continue;
    entry.chitCount += 1;
    for (const member of chit.members ?? []) {
      entry.reportCount += Array.isArray(member.reports)
        ? member.reports.length
        : 0;
    }
  }
  return map;
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
    const users = await listUsersByRole(USER_ROLES.BRANCH_STORE, query);
    return users.map(formatUser);
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
    const users = await listUsersByRole(USER_ROLES.AGENT, query);
    const ids = users.map((u) => u._id.toString());
    const statsMap = await loadAgentListStats(ids);

    return users.map((user) => {
      const id = user._id.toString();
      const stats = statsMap.get(id) ?? { chitCount: 0, reportCount: 0 };
      return {
        ...formatUser(user),
        chitCount: stats.chitCount,
        reportCount: stats.reportCount,
      };
    });
  }

  async getAgentById(agentId: string) {
    const user = await User.findById(agentId);
    if (!user || user.role !== USER_ROLES.AGENT) {
      throw notFound('Agent not found');
    }

    const [chits, nominees] = await Promise.all([
      loadOperatorChits({ agentId: user._id }),
      loadNominees(user.nominees),
    ]);
    const address = user.currentAddress ?? user.aadhaarAddress ?? null;
    const aadhaarVerified = isAadhaarVerified(user);

    return {
      ...formatUser(user),
      phone2: user.phone2 ?? null,
      address: formatAddress(address),
      aadhaarVerified,
      aadhaarStatus: aadhaarVerified ? ('verified' as const) : ('pending' as const),
      nominees,
      chitCount: chits.length,
      chits,
    };
  }

  async updateAgentProfile(agentId: string, input: UpdateUserProfileInput) {
    const user = await User.findById(agentId);
    if (!user || user.role !== USER_ROLES.AGENT) {
      throw notFound('Agent not found');
    }
    await this.applyProfileUpdate(user, input, 'agent');
    return this.getAgentById(agentId);
  }

  async updateBidderProfile(bidderId: string, input: UpdateUserProfileInput) {
    const user = await User.findById(bidderId);
    if (!user || user.role !== USER_ROLES.BIDDER) {
      throw notFound('Bidder not found');
    }
    await this.applyProfileUpdate(user, input, 'bidder');
    return this.getBidderById(bidderId);
  }

  private async applyProfileUpdate(
    user: IUserDocument,
    input: UpdateUserProfileInput,
    label: string
  ) {
    if (input.phone2 !== undefined) {
      const raw = input.phone2.trim();
      if (!raw) {
        user.phone2 = null;
      } else {
        const phone2 = normalizePhone(raw);
        if (!isValidIndianPhone(phone2)) {
          throw badRequest('Enter a valid 10-digit Indian mobile number for phone2');
        }
        user.phone2 = phone2;
      }
    }

    if (input.currentAddress !== undefined) {
      const base = user.currentAddress ?? user.aadhaarAddress ?? null;
      const merged = {
        street: input.currentAddress.street ?? base?.street ?? '',
        city: input.currentAddress.city ?? base?.city ?? '',
        state: input.currentAddress.state ?? base?.state ?? '',
        pincode: input.currentAddress.pincode ?? base?.pincode ?? '',
        country: input.currentAddress.country ?? base?.country ?? 'India',
      };
      const missing = (['street', 'city', 'state', 'pincode'] as const).filter(
        (key) => !merged[key].trim()
      );
      if (missing.length) {
        throw badRequest(
          `Address is incomplete for this ${label}; provide ${missing.join(', ')}`
        );
      }
      user.currentAddress = merged;
    }

    await user.save();
  }

  async getBranchStoreById(branchStoreId: string) {
    const user = await User.findById(branchStoreId);
    if (!user || user.role !== USER_ROLES.BRANCH_STORE) {
      throw notFound('Branch store not found');
    }

    const [chits, nominees] = await Promise.all([
      loadOperatorChits({ branchStoreId: user._id }),
      loadNominees(user.nominees),
    ]);
    const address = user.currentAddress ?? user.aadhaarAddress ?? null;
    const aadhaarVerified = isAadhaarVerified(user);

    return {
      ...formatUser(user),
      phone2: user.phone2 ?? null,
      address: formatAddress(address),
      aadhaarVerified,
      aadhaarStatus: aadhaarVerified ? ('verified' as const) : ('pending' as const),
      nominees,
      chitCount: chits.length,
      chits,
    };
  }

  async getBidderById(bidderId: string) {
    return operatorBidderService.getByIdPlatform(bidderId);
  }

  async listBidderReports(bidderId: string) {
    return operatorBidderService.listBidderReportsPlatform(bidderId);
  }

  async listReports(query: ListOperatorReportsQueryInput) {
    return operatorBidderService.listPlatformReports(query);
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
    const users = await listUsersByRole(USER_ROLES.BIDDER, query);
    const ids = users.map((u) => u._id.toString());
    const createdByIds = users
      .map((u) => u.createdBy?.toString())
      .filter((id): id is string => !!id);

    const [statsMap, creatorMap] = await Promise.all([
      operatorBidderService.getPlatformStatsForBidders(ids),
      resolveCreatorMeta(createdByIds),
    ]);

    return users.map((user) => {
      const id = user._id.toString();
      const createdBy = user.createdBy?.toString() ?? null;
      const creator = createdBy ? creatorMap.get(createdBy) : undefined;
      const createdByName = creator?.name ?? null;
      const createdByRole = creator?.role ?? null;
      const stats = statsMap.get(id) ?? {
        chitCount: 0,
        reportCount: 0,
      };

      return {
        ...formatUser(user),
        createdByName,
        createdByRole,
        /** Creator name until assigned under an agent; then agent name. */
        agentName: createdByName,
        chitCount: stats.chitCount,
        reportCount: stats.reportCount,
      };
    });
  }

  async assignBidderToAgent(bidderId: string, agentId: string) {
    const bidder = await User.findById(bidderId);
    if (!bidder || bidder.role !== USER_ROLES.BIDDER) {
      throw notFound('Bidder not found');
    }

    const agent = await User.findById(agentId);
    if (!agent || agent.role !== USER_ROLES.AGENT) {
      throw badRequest('Target must be a valid agent');
    }

    bidder.createdBy = agent._id;
    await bidder.save();

    return {
      ...formatUser(bidder),
      createdByName: agent.name,
      createdByRole: agent.role,
      agentName: agent.name,
    };
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
    const users = await listUsersByRole(USER_ROLES.SUPER_ADMIN, query);
    return users.map(formatUser);
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
