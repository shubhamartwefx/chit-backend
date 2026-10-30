import { conflict } from '../../common/errors';
import { User } from './user.model';

/**
 * Aadhaar may authenticate / sign up exactly once platform-wide
 * (any role). Phone uniqueness remains role-scoped separately.
 */
export async function assertAadhaarFingerprintAvailable(
  aadhaarFingerprint: string
): Promise<void> {
  const existing = await User.findOne({ aadhaarFingerprint })
    .select('_id role')
    .lean();

  if (existing) {
    throw conflict(
      'An account already exists for this Aadhaar number. Aadhaar authentication can only be used once.'
    );
  }
}
