import { connectDatabase } from '../config/db';
import { PERMISSIONS, USER_ROLES } from '../config/roles';
import { User } from '../modules/users/user.model';

/**
 * One-time migration: grant `chits:write` to existing agent users
 * who were created before AGENT_DEFAULT included write access.
 * Safe to run multiple times.
 */
async function migrateAgentChitsWrite() {
  await connectDatabase();

  const result = await User.updateMany(
    {
      role: USER_ROLES.AGENT,
      permissions: { $nin: [PERMISSIONS.CHITS.WRITE] },
    },
    { $addToSet: { permissions: PERMISSIONS.CHITS.WRITE } }
  );

  console.log('Migration complete (agent chits:write):', {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });

  process.exit(0);
}

migrateAgentChitsWrite().catch((err) => {
  console.error(err);
  process.exit(1);
});
