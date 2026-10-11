import { decryptAadhaar } from '../../common/sensitive-data';
import { USER_ROLES, UserRole } from '../../config/roles';
import { IUserDocument } from '../users/user.model';

interface RevealableFieldDefinition {
  /** Target user roles this field may be revealed for. */
  roles: readonly UserRole[];
  /** Mongoose select string loading the stored (encrypted) value. */
  select: string;
  /** Returns the plaintext value, or null when nothing is on file. */
  resolve: (user: IUserDocument) => string | null;
}

export const AADHAAR_REVEALABLE_ROLES: readonly UserRole[] = [
  USER_ROLES.AGENT,
  USER_ROLES.BIDDER,
  USER_ROLES.BRANCH_STORE,
];

/** Registry of fields privileged staff may reveal; add future private fields here. */
export const REVEALABLE_FIELDS = {
  aadhaar: {
    roles: AADHAAR_REVEALABLE_ROLES,
    select: '+aadhaarEncrypted aadhaarLast4 role',
    resolve: (user) =>
      user.aadhaarEncrypted ? decryptAadhaar(user.aadhaarEncrypted) : null,
  },
} satisfies Record<string, RevealableFieldDefinition>;

export type RevealableField = keyof typeof REVEALABLE_FIELDS;

export const REVEALABLE_FIELD_NAMES = Object.keys(REVEALABLE_FIELDS) as [
  RevealableField,
  ...RevealableField[],
];
