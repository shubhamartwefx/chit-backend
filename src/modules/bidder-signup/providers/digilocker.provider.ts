import { unauthorized } from '../../../common/errors';
import { IVerifiedAadhaarProfile } from '../bidder-signup.model';
import { MOCK_AADHAAR_DEMOGRAPHICS } from './aadhaar-kyc.provider';

export const MOCK_DIGILOCKER_CODE = 'mock-digilocker-code';

export interface DigiLockerProvider {
  buildAuthorizationUrl(state: string, redirectUri: string): string;
  /**
   * Exchange auth code for profile.
   * Mock returns demo demographics; `aadhaarLast4` is supplied by the caller
   * (derived from a session-scoped synthetic Aadhaar).
   */
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
    // Mock "portal": opening this URL completes verification via our callback.
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
