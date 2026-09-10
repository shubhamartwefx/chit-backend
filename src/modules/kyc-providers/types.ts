export interface IVerifiedAadhaarProfile {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  aadhaarAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  aadhaarLast4: string;
}

export type MockAadhaarRole = 'agent' | 'bidder' | 'branch_store';

export type MockAadhaarDemographics = Omit<
  IVerifiedAadhaarProfile,
  'aadhaarLast4'
>;

/** Distinct demo Aadhaar KYC payloads per portal role (client review). */
export const MOCK_AADHAAR_BY_ROLE: Record<
  MockAadhaarRole,
  MockAadhaarDemographics
> = {
  agent: {
    fullName: 'Rajesh Kumar',
    gender: 'Male',
    dateOfBirth: '15/08/1990',
    aadhaarAddress: {
      street: '42, MG Road, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      country: 'India',
    },
  },
  bidder: {
    fullName: 'Priya Sharma',
    gender: 'Female',
    dateOfBirth: '22/03/1994',
    aadhaarAddress: {
      street: '18, Banjara Hills Road No. 12',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
      country: 'India',
    },
  },
  branch_store: {
    fullName: 'Anil Reddy',
    gender: 'Male',
    dateOfBirth: '05/11/1985',
    aadhaarAddress: {
      street: '7, Anna Salai, Teynampet',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600018',
      country: 'India',
    },
  },
};

/** @deprecated Prefer MOCK_AADHAAR_BY_ROLE.agent */
export const MOCK_AADHAAR_DEMOGRAPHICS: MockAadhaarDemographics =
  MOCK_AADHAAR_BY_ROLE.agent;

/** Seed Aadhaar last-4 → role (matches npm run seed). */
const SEED_LAST4_ROLE: Record<string, MockAadhaarRole> = {
  '1111': 'branch_store',
  '2222': 'agent',
  '3333': 'bidder',
};

export function resolveMockAadhaarRole(
  role?: MockAadhaarRole | string | null,
  aadhaarLast4?: string
): MockAadhaarRole {
  if (role === 'agent' || role === 'bidder' || role === 'branch_store') {
    return role;
  }
  if (aadhaarLast4 && SEED_LAST4_ROLE[aadhaarLast4]) {
    return SEED_LAST4_ROLE[aadhaarLast4];
  }
  return 'agent';
}

export function getMockAadhaarDemographics(
  role?: MockAadhaarRole | string | null,
  aadhaarLast4?: string
): MockAadhaarDemographics {
  return MOCK_AADHAAR_BY_ROLE[resolveMockAadhaarRole(role, aadhaarLast4)];
}

export function buildMockAadhaarProfile(
  aadhaarLast4: string,
  role?: MockAadhaarRole | string | null
): IVerifiedAadhaarProfile {
  return {
    ...getMockAadhaarDemographics(role, aadhaarLast4),
    aadhaarLast4,
  };
}
