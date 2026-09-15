import {
  fingerprintAadhaar,
  isValidAadhaar,
  isValidIndianPhone,
  normalizeAadhaar,
  normalizePhone,
} from '../../common/crypto';
import { badRequest, unauthorized } from '../../common/errors';
import { env } from '../../config/env';
import {
  ROLE_DASHBOARD_PATH,
  toClientRole,
  USER_ROLES,
  USER_STATUS,
} from '../../config/roles';
import { resolveSuperAdminTier } from '../../config/rbac';
import { User, type IUserDocument } from '../users/user.model';
import type { UpdateProfileInput } from './auth.validation';

export type NomineeSummary = {
  id: string;
  name: string;
  phone: string;
  countryCode: string;
  aadhaarLast4: string | null;
  role: string;
};

function toNomineeSummary(user: IUserDocument): NomineeSummary {
  return {
    id: user._id.toString(),
    name: user.name,
    phone: user.phone,
    countryCode: user.countryCode,
    aadhaarLast4: user.aadhaarLast4 ?? null,
    role: toClientRole(user.role),
  };
}

export class ProfileService {
  private async resolveNominees(
    user: IUserDocument
  ): Promise<NomineeSummary[]> {
    const links = user.nominees ?? [];
    if (!links.length) return [];

    const ids = links.map((link) => link.userId);
    const found = await User.find({
      _id: { $in: ids },
      status: USER_STATUS.ACTIVE,
    }).select('name phone countryCode aadhaarLast4 role');

    const byId = new Map(found.map((u) => [u._id.toString(), u]));
    const summaries: NomineeSummary[] = [];
    for (const link of links) {
      const nominee = byId.get(link.userId.toString());
      if (nominee) summaries.push(toNomineeSummary(nominee));
    }
    return summaries;
  }

  async formatProfile(userId: string) {
    const user = await User.findById(userId).select(
      '-aadhaarFingerprint -__v'
    );
    if (!user) {
      throw unauthorized('User not found');
    }

    const nominees = await this.resolveNominees(user);

    return {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      phone2: user.phone2 ?? null,
      countryCode: user.countryCode,
      role: toClientRole(user.role),
      permissions: user.permissions,
      internalRole: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      totpEnabled: Boolean(user.totpEnabled),
      screenLockEnabled: Boolean(user.screenLockEnabled),
      biometricEnabled: Boolean(user.biometricEnabled),
      gender: user.gender ?? null,
      dateOfBirth: user.dateOfBirth ?? null,
      aadhaarLast4: user.aadhaarLast4 ?? null,
      aadhaarAddress: user.aadhaarAddress ?? null,
      currentAddress: user.currentAddress ?? null,
      nominees,
      redirectTo: ROLE_DASHBOARD_PATH[user.role],
      ...(user.role === USER_ROLES.SUPER_ADMIN
        ? { tier: resolveSuperAdminTier(user.permissions) }
        : {}),
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await User.findById(userId);
    if (!user) {
      throw unauthorized('User not found');
    }

    if (input.phone2 !== undefined) {
      const raw = (input.phone2 ?? '').trim();
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
      user.currentAddress = input.currentAddress
        ? {
            street: input.currentAddress.street.trim(),
            city: input.currentAddress.city.trim(),
            state: input.currentAddress.state.trim(),
            pincode: input.currentAddress.pincode.trim(),
            country: (input.currentAddress.country ?? 'India').trim(),
          }
        : null;
    }

    if (input.nomineeUserIds !== undefined) {
      const uniqueIds = [...new Set(input.nomineeUserIds)];
      if (uniqueIds.length > 2) {
        throw badRequest('You can link at most 2 nominees');
      }
      if (uniqueIds.includes(userId)) {
        throw badRequest('You cannot set yourself as a nominee');
      }

      if (uniqueIds.length === 0) {
        user.nominees = [];
      } else {
        const nominees = await User.find({
          _id: { $in: uniqueIds },
          status: USER_STATUS.ACTIVE,
        }).select('_id');

        if (nominees.length !== uniqueIds.length) {
          throw badRequest(
            'One or more nominees were not found or are inactive'
          );
        }

        const now = new Date();
        user.nominees = uniqueIds.map((id) => ({
          userId: nominees.find((n) => n._id.toString() === id)!._id,
          linkedAt: now,
        }));
      }
    }

    await user.save();
    return this.formatProfile(userId);
  }

  async searchNominees(userId: string, q: string) {
    const query = q.replace(/\s/g, '').trim();
    if (!query) {
      throw badRequest('Enter a phone number or Aadhaar number to search');
    }

    let filter: Record<string, unknown>;
    if (/^\d{10}$/.test(query) && isValidIndianPhone(query)) {
      filter = { phone: normalizePhone(query), status: USER_STATUS.ACTIVE };
    } else if (isValidAadhaar(query)) {
      filter = {
        aadhaarFingerprint: fingerprintAadhaar(
          normalizeAadhaar(query),
          env.JWT_SECRET
        ),
        status: USER_STATUS.ACTIVE,
      };
    } else {
      throw badRequest(
        'Search with a 10-digit phone number or a 12-digit Aadhaar number'
      );
    }

    const users = await User.find(filter)
      .select('name phone countryCode aadhaarLast4 role')
      .limit(10);

    return users
      .filter((u) => u._id.toString() !== userId)
      .map(toNomineeSummary);
  }
}

export const profileService = new ProfileService();
