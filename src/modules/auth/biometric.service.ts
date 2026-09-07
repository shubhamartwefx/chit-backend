import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { badRequest, unauthorized } from '../../common/errors';
import { env } from '../../config/env';
import { User } from '../users/user.model';

type Transport =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';

export class BiometricService {
  async status(userId: string) {
    const user = await User.findById(userId).select(
      'biometricEnabled webauthnCredentials'
    );
    if (!user) throw unauthorized('User not found');

    return {
      enabled: Boolean(user.biometricEnabled),
      credentialCount: user.webauthnCredentials?.length ?? 0,
    };
  }

  async registerOptions(userId: string) {
    const user = await User.findById(userId).select(
      '+webauthnChallenge +webauthnChallengeExpiresAt phone name webauthnCredentials'
    );
    if (!user) throw unauthorized('User not found');

    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userID: new TextEncoder().encode(user._id.toString()),
      userName: user.phone,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: (user.webauthnCredentials ?? []).map((c) => ({
        id: c.credentialId,
        transports: c.transports as Transport[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    user.webauthnChallenge = options.challenge;
    user.webauthnChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    return options;
  }

  async registerVerify(userId: string, body: RegistrationResponseJSON) {
    const user = await User.findById(userId).select(
      '+webauthnChallenge +webauthnChallengeExpiresAt webauthnCredentials biometricEnabled'
    );
    if (!user) throw unauthorized('User not found');

    if (
      !user.webauthnChallenge ||
      !user.webauthnChallengeExpiresAt ||
      user.webauthnChallengeExpiresAt.getTime() < Date.now()
    ) {
      throw badRequest(
        'Registration challenge expired. Request options again.'
      );
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: user.webauthnChallenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw unauthorized('Biometric registration failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const credentialId =
      typeof credential.id === 'string'
        ? credential.id
        : Buffer.from(credential.id).toString('base64url');

    const publicKey = Buffer.from(credential.publicKey).toString('base64url');

    user.webauthnCredentials = user.webauthnCredentials ?? [];
    user.webauthnCredentials.push({
      credentialId,
      publicKey,
      counter: credential.counter,
      transports: body.response.transports,
      createdAt: new Date(),
    });
    user.biometricEnabled = true;
    user.webauthnChallenge = null;
    user.webauthnChallengeExpiresAt = null;
    await user.save();

    return {
      enabled: true,
      credentialCount: user.webauthnCredentials.length,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    };
  }

  async authenticateOptions(userId: string) {
    const user = await User.findById(userId).select(
      '+webauthnChallenge +webauthnChallengeExpiresAt webauthnCredentials biometricEnabled'
    );
    if (!user) throw unauthorized('User not found');

    const credentials = user.webauthnCredentials ?? [];
    if (!user.biometricEnabled || credentials.length === 0) {
      throw badRequest('No biometric credentials registered');
    }

    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as Transport[] | undefined,
      })),
      userVerification: 'preferred',
    });

    user.webauthnChallenge = options.challenge;
    user.webauthnChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    return options;
  }

  async authenticateVerify(userId: string, body: AuthenticationResponseJSON) {
    const user = await User.findById(userId).select(
      '+webauthnChallenge +webauthnChallengeExpiresAt webauthnCredentials biometricEnabled'
    );
    if (!user) throw unauthorized('User not found');

    if (
      !user.webauthnChallenge ||
      !user.webauthnChallengeExpiresAt ||
      user.webauthnChallengeExpiresAt.getTime() < Date.now()
    ) {
      throw badRequest(
        'Authentication challenge expired. Request options again.'
      );
    }

    const stored = (user.webauthnCredentials ?? []).find(
      (c) => c.credentialId === body.id
    );
    if (!stored) {
      throw unauthorized('Unknown biometric credential');
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: user.webauthnChallenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      credential: {
        id: stored.credentialId,
        publicKey: Buffer.from(stored.publicKey, 'base64url'),
        counter: stored.counter,
        transports: stored.transports as Transport[] | undefined,
      },
    });

    if (!verification.verified) {
      throw unauthorized('Biometric authentication failed');
    }

    stored.counter = verification.authenticationInfo.newCounter;
    user.webauthnChallenge = null;
    user.webauthnChallengeExpiresAt = null;
    await user.save();

    return { verified: true, unlocked: true };
  }

  async disable(userId: string) {
    const user = await User.findById(userId).select(
      'biometricEnabled webauthnCredentials'
    );
    if (!user) throw unauthorized('User not found');

    user.biometricEnabled = false;
    user.webauthnCredentials = [];
    await user.save();

    return { enabled: false, credentialCount: 0 };
  }
}

export const biometricService = new BiometricService();
