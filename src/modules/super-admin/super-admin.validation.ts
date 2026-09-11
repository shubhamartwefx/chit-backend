import { z } from 'zod';
import {
  AGENT_DEFAULT,
  BIDDER_DEFAULT,
  BRANCH_STORE_ASSIGNABLE,
  PERMISSIONS,
} from '../../config/constants';
import {
  permissionsForSuperAdminTier,
  SUPER_ADMIN_TIERS,
} from '../../config/rbac';

const userIdentityFields = {
  name: z.string().min(2).max(120),
  countryCode: z.string().min(1).default('+91'),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\d+$/, 'Phone must contain digits only'),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
};

export const createBranchStoreSchema = z.object({
  ...userIdentityFields,
  permissions: z
    .array(
      z.enum(BRANCH_STORE_ASSIGNABLE as unknown as [string, ...string[]])
    )
    .min(1, 'Assign at least one permission'),
});

export type CreateBranchStoreInput = z.infer<typeof createBranchStoreSchema>;

/** @deprecated Use createBranchStoreSchema */
export const createAdminSchema = createBranchStoreSchema;
export type CreateAdminInput = CreateBranchStoreInput;

export const createAgentSchema = z.object({
  ...userIdentityFields,
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const createBidderSchema = z.object({
  ...userIdentityFields,
});

export type CreateBidderInput = z.infer<typeof createBidderSchema>;

export const createStaffSchema = z
  .object({
    ...userIdentityFields,
    tier: z.enum(SUPER_ADMIN_TIERS).default('editor'),
  })
  .transform((data) => ({
    ...data,
    permissions: [...permissionsForSuperAdminTier(data.tier)],
  }));

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const listUsersQuerySchema = z.object({
  q: z.string().max(80).optional(),
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
});

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;

export const assignablePermissionsResponse = {
  branchStore: BRANCH_STORE_ASSIGNABLE,
  agent: AGENT_DEFAULT,
  bidder: BIDDER_DEFAULT,
  superAdminTiers: SUPER_ADMIN_TIERS,
  platformTiers: {
    full: PERMISSIONS.PLATFORM.ALL,
    manager: PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    editor: PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
  },
};
