import { unauthorized } from '../../common/errors';
import {
  buildMockAadhaarProfile,
  type IVerifiedAadhaarProfile,
  type MockAadhaarRole,
  MOCK_AADHAAR_DEMOGRAPHICS,
} from './types';

export const MOCK_DIGILOCKER_CODE = 'mock-digilocker-code';

export interface DigiLockerProvider {
  buildAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeAndFetchProfile(
    code: string,
    aadhaarLast4: string,
    role?: MockAadhaarRole
  ): Promise<IVerifiedAadhaarProfile>;
}

export class MockDigiLockerProvider implements DigiLockerProvider {
  constructor(private readonly role: MockAadhaarRole = 'agent') {}

  buildAuthorizationUrl(state: string, redirectUri: string): string {
    const url = new URL(redirectUri);
    url.searchParams.set('code', MOCK_DIGILOCKER_CODE);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeAndFetchProfile(
    code: string,
    aadhaarLast4: string,
    role?: MockAadhaarRole
  ): Promise<IVerifiedAadhaarProfile> {
    if (code !== MOCK_DIGILOCKER_CODE) {
      throw unauthorized('Invalid DigiLocker authorization code');
    }

    return buildMockAadhaarProfile(aadhaarLast4, role ?? this.role);
  }
}

export function createDigiLockerProvider(
  role: MockAadhaarRole = 'agent'
): DigiLockerProvider {
  return new MockDigiLockerProvider(role);
}

export { MOCK_AADHAAR_DEMOGRAPHICS };
