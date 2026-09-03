import { connectDatabase } from '../config/db';
import { USER_ROLES } from '../config/roles';
import { User } from '../modules/users/user.model';

/**
 * One-time migration: rename legacy `admin` role to `branch_store`.
 * Safe to run multiple times (no-op if no admin users remain).
 */
async function migrateAdminToBranchStore() {
  await connectDatabase();

  const result = await User.updateMany(
    { role: 'admin' },
    { $set: { role: USER_ROLES.BRANCH_STORE } }
  );

  console.log('Migration complete:', {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });

  process.exit(0);
}

migrateAdminToBranchStore().catch((err) => {
  console.error(err);
  process.exit(1);
});
