import { z } from 'zod';
import { USER_ROLES } from '../../config/roles';

export const DIRECTORY_QUERY_LIMITS = {
  minLength: 3,
  maxLength: 40,
} as const;

export const DIRECTORY_ROLES = [USER_ROLES.BIDDER, USER_ROLES.AGENT] as const;

export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

export const directorySearchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(DIRECTORY_QUERY_LIMITS.minLength)
      .max(DIRECTORY_QUERY_LIMITS.maxLength),
    role: z.enum(DIRECTORY_ROLES).optional(),
  })
  .strict();

export type DirectorySearchQueryInput = z.infer<typeof directorySearchQuerySchema>;

export const directoryUserIdParamsSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId'),
});
