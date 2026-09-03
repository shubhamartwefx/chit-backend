import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { fingerprintAadhaar } from '../common/crypto';
import {
  AGENT_DEFAULT,
  BIDDER_DEFAULT,
  PERMISSIONS,
  ROLE_PRIMARY_SLUG,
  USER_ROLES,
  USER_STATUS,
} from '../config/roles';
import { permissionsForSuperAdminTier } from '../config/rbac';
import { User } from '../modules/users/user.model';

interface SeedUser {
  key: string;
  name: string;
  countryCode: string;
  phone: string;
  aadhaar: string;
  role: (typeof USER_ROLES)[keyof typeof USER_ROLES];
  permissions: string[];
}

const SEED_USERS: SeedUser[] = [
  {
    key: 'super_admin',
    name: env.SEED_SUPER_ADMIN_NAME,
    countryCode: env.SEED_SUPER_ADMIN_COUNTRY_CODE,
    phone: env.SEED_SUPER_ADMIN_PHONE,
    aadhaar: env.SEED_SUPER_ADMIN_AADHAAR,
    role: USER_ROLES.SUPER_ADMIN,
    permissions: [...permissionsForSuperAdminTier('full')],
  },
  {
    key: 'branch_store',
    name: 'Demo Branch Store',
    countryCode: '+91',
    phone: '9888888881',
    aadhaar: '111111111111',
    role: USER_ROLES.BRANCH_STORE,
    permissions: [
      PERMISSIONS.BIDDERS.READ,
      PERMISSIONS.CHITS.READ,
      PERMISSIONS.REPORTS.READ,
    ],
  },
  {
    key: 'agent',
    name: 'Demo Agent',
    countryCode: '+91',
    phone: '9888888882',
    aadhaar: '222222222222',
    role: USER_ROLES.AGENT,
    permissions: [...AGENT_DEFAULT],
  },
  {
    key: 'bidder',
    name: 'Demo Bidder',
    countryCode: '+91',
    phone: '9888888883',
    aadhaar: '333333333333',
    role: USER_ROLES.BIDDER,
    permissions: [...BIDDER_DEFAULT],
  },
];

async function seed() {
  await connectDatabase();

  for (const seedUser of SEED_USERS) {
    const aadhaarFingerprint = fingerprintAadhaar(
      seedUser.aadhaar,
      env.JWT_SECRET
    );

    const existing = await User.findOne({
      role: seedUser.role,
      phone: seedUser.phone,
    });

    if (existing) {
      console.log(`[skip] ${seedUser.key} already exists:`, {
        id: existing._id.toString(),
        phone: existing.phone,
        role: existing.role,
      });
      continue;
    }

    const user = await User.create({
      name: seedUser.name,
      countryCode: seedUser.countryCode,
      phone: seedUser.phone,
      aadhaarFingerprint,
      role: seedUser.role,
      permissions: seedUser.permissions,
      status: USER_STATUS.ACTIVE,
    });

    console.log(`[created] ${seedUser.key}:`, {
      id: user._id.toString(),
      phone: user.phone,
      role: user.role,
    });
  }

  console.log('\nDemo credentials (mock OTP):');
  for (const seedUser of SEED_USERS) {
    const slug = ROLE_PRIMARY_SLUG[seedUser.role];
    console.log(`\n  ${seedUser.key}:`);
    console.log(`    Portal:   /${slug}/login`);
    console.log(`    Phone:    ${seedUser.countryCode} ${seedUser.phone}`);
    console.log(`    Aadhaar:  ${seedUser.aadhaar}`);
  }
  console.log(`\n  OTP (all): ${env.MOCK_OTP}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
