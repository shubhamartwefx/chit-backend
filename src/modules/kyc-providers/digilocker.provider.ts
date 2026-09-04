import { unauthorized } from '../../common/errors';
import { IVerifiedAadhaarProfile, MOCK_AADHAAR_DEMOGRAPHICS } from './types';

export const MOCK_DIGILOCKER_CODE = 'mock-digilocker-code';

export interface DigiLockerProvider {
  buildAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeAndFetchProfile(
    code: string,
    aadhaarLast4: string
  ): Promise<IVerifiedAadhaarProfile>;
}

export class MockDigiLockerProvider implements DigiLockerProvider {
  buildAuthorizationUrl(state: string, redirectUri: string): string {
    const url = new URL(redirectUri);
    url.searchParams.set('code', MOCK_DIGILOCKER_CODE);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeAndFetchProfile(
    code: string,
    aadhaarLast4: string
  ): Promise<IVerifiedAadhaarProfile> {
    if (code !== MOCK_DIGILOCKER_CODE) {
      throw unauthorized('Invalid DigiLocker authorization code');
    }

    return {
      ...MOCK_AADHAAR_DEMOGRAPHICS,
      aadhaarLast4,
    };
  }
}

export function createDigiLockerProvider(): DigiLockerProvider {
  return new MockDigiLockerProvider();
}
