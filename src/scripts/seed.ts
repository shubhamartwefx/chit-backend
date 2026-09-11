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
  // Extra active users for nominee search (Profile → Nominee tab)
  {
    key: 'nominee_rahul',
    name: 'Rahul Verma',
    countryCode: '+91',
    phone: '9777777771',
    aadhaar: '444444444441',
    role: USER_ROLES.BIDDER,
    permissions: [...BIDDER_DEFAULT],
  },
  {
    key: 'nominee_sneha',
    name: 'Sneha Iyer',
    countryCode: '+91',
    phone: '9777777772',
    aadhaar: '555555555552',
    role: USER_ROLES.BIDDER,
    permissions: [...BIDDER_DEFAULT],
  },
  {
    key: 'nominee_vikram',
    name: 'Vikram Patel',
    countryCode: '+91',
    phone: '9777777773',
    aadhaar: '666666666663',
    role: USER_ROLES.AGENT,
    permissions: [...AGENT_DEFAULT],
  },
];

function kycFields(seedUser: SeedUser) {
  if (seedUser.kycRole) {
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

  // Lightweight KYC for nominee search candidates
  return {
    name: seedUser.name,
    gender: 'Male',
    dateOfBirth: '01/01/1992',
    aadhaarAddress: {
      street: '12, Demo Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      country: 'India',
    },
    aadhaarLast4: seedUser.aadhaar.slice(-4),
    aadhaarVerifiedAt: new Date(),
    currentAddress: '12, Demo Street, Pune, Maharashtra, 411001',
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
      existing.name = profile.name || seedUser.name || existing.name;
      if (profile.gender !== undefined) existing.gender = profile.gender ?? existing.gender;
      if (profile.dateOfBirth !== undefined) {
        existing.dateOfBirth = profile.dateOfBirth ?? existing.dateOfBirth;
      }
      if (profile.aadhaarAddress) {
        existing.aadhaarAddress = profile.aadhaarAddress;
      }
      if (profile.aadhaarLast4) existing.aadhaarLast4 = profile.aadhaarLast4;
      if (profile.aadhaarVerifiedAt) {
        existing.aadhaarVerifiedAt = profile.aadhaarVerifiedAt;
      }
      if (profile.currentAddress) {
        existing.currentAddress = profile.currentAddress;
      }
      await existing.save();
      console.log(`[updated] ${seedUser.key}:`, {
        id: existing._id.toString(),
        name: existing.name,
        phone: existing.phone,
        aadhaarLast4: existing.aadhaarLast4,
      });
      continue;
    }

    const user = await User.create({
      countryCode: seedUser.countryCode,
      phone: seedUser.phone,
      aadhaarFingerprint,
      role: seedUser.role,
      permissions: seedUser.permissions,
      status: USER_STATUS.ACTIVE,
      ...profile,
      name: profile.name || seedUser.name,
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

  console.log('\nNominee search test values (Profile → Nominee → Add Nominee):');
  console.log('  Rahul Verma   phone 9777777771  aadhaar 444444444441');
  console.log('  Sneha Iyer    phone 9777777772  aadhaar 555555555552');
  console.log('  Vikram Patel  phone 9777777773  aadhaar 666666666663');
  console.log('  (You can also search other seed users, e.g. 9888888883 / 333333333333)');

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
