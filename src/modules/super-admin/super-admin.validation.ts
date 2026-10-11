import { z } from 'zod';
import {
  AGENT_DEFAULT,
  BIDDER_DEFAULT,
  BRANCH_STORE_ASSIGNABLE,
  PERMISSIONS,
} from '../../config/constants';
import {
  permissionsForSuperAdminTier,
  SUPER_ADMIN_GRANTABLE,
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

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

export const userIdParamsSchema = z.object({
  userId: objectIdSchema,
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;

export const resourceIdParamsSchema = z.object({
  id: objectIdSchema,
});

export type ResourceIdParams = z.infer<typeof resourceIdParamsSchema>;

export const assignBidderAgentSchema = z.object({
  agentId: objectIdSchema,
});

export type AssignBidderAgentInput = z.infer<typeof assignBidderAgentSchema>;

export const updateUserProfileSchema = z
  .object({
    phone2: z
      .string()
      .max(15)
      .regex(/^$|^\d+$/, 'Phone must contain digits only')
      .optional(),
    currentAddress: z
      .object({
        street: z.string().trim().min(1).max(300).optional(),
        city: z.string().trim().min(1).max(100).optional(),
        state: z.string().trim().min(1).max(100).optional(),
        pincode: z
          .string()
          .trim()
          .regex(/^\d{6}$/, 'Pincode must be 6 digits')
          .optional(),
        country: z.string().trim().min(1).max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((val) => val.phone2 !== undefined || val.currentAddress !== undefined, {
    message: 'Provide at least one of phone2 or currentAddress',
  });

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const updateAgentProfileSchema = updateUserProfileSchema;
export type UpdateAgentProfileInput = UpdateUserProfileInput;

export const userStatusActionSchema = z.object({
  reason: z.string().min(5).max(500),
});

export type UserStatusActionInput = z.infer<typeof userStatusActionSchema>;

const grantablePermissionListSchema = z
  .array(z.enum(SUPER_ADMIN_GRANTABLE))
  .max(SUPER_ADMIN_GRANTABLE.length);

export const updateStaffPermissionsSchema = z
  .object({
    add: grantablePermissionListSchema.optional(),
    remove: grantablePermissionListSchema.optional(),
  })
  .strict()
  .refine((val) => (val.add?.length ?? 0) + (val.remove?.length ?? 0) > 0, {
    message: 'Provide at least one permission to add or remove',
  })
  .refine(
    (val) => !(val.add ?? []).some((perm) => (val.remove ?? []).includes(perm)),
    { message: 'A permission cannot be both added and removed' }
  );

export type UpdateStaffPermissionsInput = z.infer<
  typeof updateStaffPermissionsSchema
>;

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
  superAdminGrantable: SUPER_ADMIN_GRANTABLE,
};
