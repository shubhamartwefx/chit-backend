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
import {
  getMockAadhaarDemographics,
  type MockAadhaarRole,
} from '../modules/kyc-providers/types';

interface SeedUser {
  key: string;
  name: string;
  countryCode: string;
  phone: string;
  aadhaar: string;
  role: (typeof USER_ROLES)[keyof typeof USER_ROLES];
  permissions: string[];
  /** When set, attach role-specific mock Aadhaar KYC onto the user. */
  kycRole?: MockAadhaarRole;
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
    name: 'Anil Reddy',
    countryCode: '+91',
    phone: '9888888881',
    aadhaar: '111111111111',
    role: USER_ROLES.BRANCH_STORE,
    permissions: [
      PERMISSIONS.BIDDERS.READ,
      PERMISSIONS.CHITS.READ,
      PERMISSIONS.REPORTS.READ,
    ],
    kycRole: 'branch_store',
  },
  {
    key: 'agent',
    name: 'Rajesh Kumar',
    countryCode: '+91',
    phone: '9888888882',
    aadhaar: '222222222222',
    role: USER_ROLES.AGENT,
    permissions: [...AGENT_DEFAULT],
    kycRole: 'agent',
  },
  {
    key: 'bidder',
    name: 'Priya Sharma',
    countryCode: '+91',
    phone: '9888888883',
    aadhaar: '333333333333',
    role: USER_ROLES.BIDDER,
    permissions: [...BIDDER_DEFAULT],
    kycRole: 'bidder',
  },
];

function kycFields(seedUser: SeedUser) {
  if (!seedUser.kycRole) return {};
  const demo = getMockAadhaarDemographics(
    seedUser.kycRole,
    seedUser.aadhaar.slice(-4)
  );
  return {
    name: demo.fullName,
    gender: demo.gender,
    dateOfBirth: demo.dateOfBirth,
    aadhaarAddress: { ...demo.aadhaarAddress },
    aadhaarLast4: seedUser.aadhaar.slice(-4),
    aadhaarVerifiedAt: new Date(),
    currentAddress: [
      demo.aadhaarAddress.street,
      demo.aadhaarAddress.city,
      demo.aadhaarAddress.state,
      demo.aadhaarAddress.pincode,
    ].join(', '),
  };
}

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

    const profile = kycFields(seedUser);

    if (existing) {
      if (seedUser.kycRole) {
        existing.name = profile.name || existing.name;
        existing.gender = profile.gender ?? existing.gender;
        existing.dateOfBirth = profile.dateOfBirth ?? existing.dateOfBirth;
        existing.aadhaarAddress = profile.aadhaarAddress ?? existing.aadhaarAddress;
        existing.aadhaarLast4 = profile.aadhaarLast4 ?? existing.aadhaarLast4;
        existing.aadhaarVerifiedAt =
          profile.aadhaarVerifiedAt ?? existing.aadhaarVerifiedAt;
        existing.currentAddress =
          profile.currentAddress ?? existing.currentAddress;
        await existing.save();
        console.log(`[updated KYC] ${seedUser.key}:`, {
          id: existing._id.toString(),
          name: existing.name,
          aadhaarLast4: existing.aadhaarLast4,
        });
      } else {
        console.log(`[skip] ${seedUser.key} already exists:`, {
          id: existing._id.toString(),
          phone: existing.phone,
          role: existing.role,
        });
      }
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
      ...profile,
    });

    console.log(`[created] ${seedUser.key}:`, {
      id: user._id.toString(),
      phone: user.phone,
      role: user.role,
      name: user.name,
    });
  }

  console.log('\nDemo credentials (mock OTP):');
  for (const seedUser of SEED_USERS) {
    const slug = ROLE_PRIMARY_SLUG[seedUser.role];
    console.log(`\n  ${seedUser.key}:`);
    console.log(`    Portal:   /${slug}/login`);
    console.log(`    Phone:    ${seedUser.countryCode} ${seedUser.phone}`);
    console.log(`    Aadhaar:  ${seedUser.aadhaar}`);
    if (seedUser.kycRole) {
      const demo = getMockAadhaarDemographics(seedUser.kycRole);
      console.log(`    KYC name: ${demo.fullName} (${demo.aadhaarAddress.city})`);
    }
  }
  console.log(`\n  OTP (all): ${env.MOCK_OTP}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
