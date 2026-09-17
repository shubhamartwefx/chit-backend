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
import { User, type IUserDocument } from '../modules/users/user.model';
import {
  getMockAadhaarDemographics,
  type MockAadhaarRole,
} from '../modules/kyc-providers/types';
import {
  Chit,
  CHIT_STATUS,
  CHIT_TYPES,
} from '../modules/chits/chit.model';

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

const SEED_CHIT_CODE = '900100200300';

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
      PERMISSIONS.AGENTS.READ,
      PERMISSIONS.BIDDERS.READ,
      PERMISSIONS.CHITS.READ,
      PERMISSIONS.CHITS.WRITE,
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
  // Enrolled nominee candidates (must be chit members to pass nominee-search)
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
    role: USER_ROLES.BIDDER,
    permissions: [...BIDDER_DEFAULT],
  },
  {
    key: 'nominee_meera',
    name: 'Meera Nair',
    countryCode: '+91',
    phone: '9777777774',
    aadhaar: '777777777774',
    role: USER_ROLES.BIDDER,
    permissions: [...BIDDER_DEFAULT],
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
      currentAddress: { ...demo.aadhaarAddress },
    };
  }

  return {
    name: seedUser.name,
    gender: 'Female',
    dateOfBirth: '15/08/1994',
    aadhaarAddress: {
      street: '12, Demo Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      country: 'India',
    },
    aadhaarLast4: seedUser.aadhaar.slice(-4),
    aadhaarVerifiedAt: new Date(),
    currentAddress: {
      street: '12, Demo Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      country: 'India',
    },
  };
}

async function upsertSeedUser(seedUser: SeedUser): Promise<IUserDocument> {
  const aadhaarFingerprint = fingerprintAadhaar(
    seedUser.aadhaar,
    env.JWT_SECRET
  );
  const profile = kycFields(seedUser);

  const existing = await User.findOne({
    role: seedUser.role,
    phone: seedUser.phone,
  });

  if (existing) {
    existing.name = profile.name || seedUser.name || existing.name;
    existing.aadhaarFingerprint = aadhaarFingerprint;
    existing.permissions = seedUser.permissions;
    existing.status = USER_STATUS.ACTIVE;
    if (profile.gender !== undefined) existing.gender = profile.gender ?? existing.gender;
    if (profile.dateOfBirth !== undefined) {
      existing.dateOfBirth = profile.dateOfBirth ?? existing.dateOfBirth;
    }
    if (profile.aadhaarAddress) existing.aadhaarAddress = profile.aadhaarAddress;
    if (profile.aadhaarLast4) existing.aadhaarLast4 = profile.aadhaarLast4;
    if (profile.aadhaarVerifiedAt) {
      existing.aadhaarVerifiedAt = profile.aadhaarVerifiedAt;
    }
    if (profile.currentAddress) existing.currentAddress = profile.currentAddress;
    await existing.save();
    console.log(`[updated] ${seedUser.key}:`, {
      id: existing._id.toString(),
      name: existing.name,
      phone: existing.phone,
      aadhaarLast4: existing.aadhaarLast4,
    });
    return existing;
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
  return user;
}

async function seedNomineeEnrollment(usersByKey: Map<string, IUserDocument>) {
  const agent = usersByKey.get('agent');
  const bidder = usersByKey.get('bidder');
  const rahul = usersByKey.get('nominee_rahul');
  const sneha = usersByKey.get('nominee_sneha');
  const vikram = usersByKey.get('nominee_vikram');
  const meera = usersByKey.get('nominee_meera');

  if (!agent || !bidder || !rahul || !sneha || !vikram || !meera) {
    throw new Error('Missing seed users required for nominee enrollment');
  }

  const memberIds = [bidder, rahul, sneha, vikram, meera];
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 20);

  const members = memberIds.map((u) => ({
    bidderId: u._id,
    numberOfTickets: 1,
    joinedAt: new Date(),
  }));

  const existingChit = await Chit.findOne({ chitCode: SEED_CHIT_CODE });
  if (existingChit) {
    existingChit.type = CHIT_TYPES.AGENT_CHIT;
    existingChit.amountInLakhs = 1;
    existingChit.govtBettingAmount = 1000;
    existingChit.monthlyInstallment = 5000;
    existingChit.maxBidders = 20;
    existingChit.totalMonths = 20;
    existingChit.govtBettingUnits = 0;
    existingChit.startDate = startDate;
    existingChit.endDate = endDate;
    existingChit.completedMonths = 0;
    existingChit.status = CHIT_STATUS.ACTIVE;
    existingChit.agentId = agent._id;
    existingChit.branchStoreId = null;
    existingChit.members = members;
    existingChit.createdBy = agent._id;
    await existingChit.save();
    console.log(`[updated] seed chit ${SEED_CHIT_CODE} with ${members.length} enrolled members`);
  } else {
    await Chit.create({
      chitCode: SEED_CHIT_CODE,
      type: CHIT_TYPES.AGENT_CHIT,
      amountInLakhs: 1,
      govtBettingAmount: 1000,
      monthlyInstallment: 5000,
      maxBidders: 20,
      totalMonths: 20,
      govtBettingUnits: 0,
      startDate,
      endDate,
      completedMonths: 0,
      status: CHIT_STATUS.ACTIVE,
      agentId: agent._id,
      branchStoreId: null,
      members,
      createdBy: agent._id,
    });
    console.log(`[created] seed chit ${SEED_CHIT_CODE} with ${members.length} enrolled members`);
  }

  // Pre-link Rahul + Sneha as the agent's nominees (max 2)
  agent.nominees = [
    { userId: rahul._id, linkedAt: new Date() },
    { userId: sneha._id, linkedAt: new Date() },
  ];
  await agent.save();
  console.log(
    `[linked] agent nominees → ${rahul.name} (${rahul.phone}), ${sneha.name} (${sneha.phone})`
  );

  return { agent, rahul, sneha, vikram, meera, bidder };
}

async function seed() {
  await connectDatabase();

  const usersByKey = new Map<string, IUserDocument>();
  for (const seedUser of SEED_USERS) {
    const user = await upsertSeedUser(seedUser);
    usersByKey.set(seedUser.key, user);
  }

  const linked = await seedNomineeEnrollment(usersByKey);

  console.log('\nDemo credentials (mock OTP):');
  for (const seedUser of SEED_USERS) {
    const slug = ROLE_PRIMARY_SLUG[seedUser.role];
    console.log(`\n  ${seedUser.key}:`);
    console.log(`    Portal:   /${slug}/login`);
    console.log(`    Phone:    ${seedUser.countryCode} ${seedUser.phone}`);
    console.log(`    Aadhaar:  ${seedUser.aadhaar}`);
    console.log(`    User ID:  ${usersByKey.get(seedUser.key)!._id.toString()}`);
    if (seedUser.kycRole) {
      const demo = getMockAadhaarDemographics(seedUser.kycRole);
      console.log(`    KYC name: ${demo.fullName} (${demo.aadhaarAddress.city})`);
    }
  }
  console.log(`\n  OTP (all): ${env.MOCK_OTP}`);

  console.log('\nNominee search (Profile → Nominee → Add Nominee):');
  console.log('  Must use phone / Aadhaar / User ID of an enrolled chit member.');
  console.log(
    `  Already linked to agent: ${linked.rahul.name} (${linked.rahul.phone}), ${linked.sneha.name} (${linked.sneha.phone})`
  );
  console.log(
    `  Also searchable: ${linked.vikram.name} phone ${linked.vikram.phone} aadhaar 666666666663 id ${linked.vikram._id}`
  );
  console.log(
    `  Also searchable: ${linked.meera.name} phone ${linked.meera.phone} aadhaar 777777777774 id ${linked.meera._id}`
  );
  console.log(
    `  Also searchable: ${linked.bidder.name} phone ${linked.bidder.phone} aadhaar 333333333333 id ${linked.bidder._id}`
  );

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
