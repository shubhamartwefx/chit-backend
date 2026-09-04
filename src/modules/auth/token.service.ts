import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { accessDenied, unauthorized } from '../../common/errors';
import { env } from '../../config/env';
import {
  canLoginWithPermissions,
  resolveSuperAdminTier,
} from '../../config/rbac';
import {
  ROLE_DASHBOARD_PATH,
  toClientRole,
  USER_ROLES,
  USER_STATUS,
  UserRole,
} from '../../config/roles';
import { JwtPayload } from '../../types/express';
import { User, IUserDocument } from '../users/user.model';
import {
  hashRefreshToken,
  hashUserAgent,
  RefreshSession,
} from './refresh-session.model';

export interface TokenPairMeta {
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
}

/** Parse durations like 15m, 7d, 3600s, or plain seconds into seconds. */
export function parseDurationToSeconds(value: string): number {
  const trimmed = value.trim();
  const match = /^(\d+)([smhd])?$/i.exec(trimmed);
  if (!match) {
    const asNum = Number(trimmed);
    if (!Number.isFinite(asNum) || asNum <= 0) {
      throw new Error(`Invalid duration: ${value}`);
    }
    return Math.floor(asNum);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 60 * 60 * 24;
    default:
      return amount;
  }
}

function accessExpiresIn(): string {
  return env.JWT_ACCESS_EXPIRES_IN || env.JWT_EXPIRES_IN;
}

function newId(): string {
  return crypto.randomUUID();
}

function newRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

function buildUserClaims(user: IUserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    phone: user.phone,
    countryCode: user.countryCode,
    role: toClientRole(user.role),
    permissions: user.permissions,
    internalRole: user.role,
    ...(user.role === USER_ROLES.SUPER_ADMIN
      ? { tier: resolveSuperAdminTier(user.permissions) }
      : {}),
  };
}

function assertUserCanHoldSession(user: IUserDocument): void {
  if (user.status !== USER_STATUS.ACTIVE) {
    throw accessDenied('Your account is inactive or blocked. Contact support.');
  }
  if (!canLoginWithPermissions(user.role, user.permissions)) {
    throw accessDenied(
      'Your account has no valid permissions assigned. Contact support.'
    );
  }
}

export class TokenService {
  async issueTokenPair(
    user: IUserDocument,
    meta: TokenPairMeta = {},
    familyId?: string
  ): Promise<IssuedTokenPair & { user: ReturnType<typeof buildUserClaims>; redirectTo: string }> {
    assertUserCanHoldSession(user);

    const sid = newId();
    const jti = newId();
    const resolvedFamilyId = familyId ?? newId();
    const refreshToken = newRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);

    const accessSeconds = parseDurationToSeconds(accessExpiresIn());
    const refreshSeconds = parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + refreshSeconds * 1000);

    await RefreshSession.create({
      sid,
      familyId: resolvedFamilyId,
      userId: user._id,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      userAgentHash: hashUserAgent(meta.userAgent),
    });

    const payload: JwtPayload = {
      sub: user._id.toString(),
      role: user.role as UserRole,
      permissions: user.permissions,
      phone: user.phone,
      name: user.name,
      jti,
      sid,
    };

    const options: SignOptions = {
      expiresIn: accessExpiresIn() as SignOptions['expiresIn'],
    };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, options);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessSeconds,
      refreshExpiresIn: refreshSeconds,
      user: buildUserClaims(user),
      redirectTo: ROLE_DASHBOARD_PATH[user.role],
    };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    meta: TokenPairMeta = {}
  ): Promise<IssuedTokenPair & { user: ReturnType<typeof buildUserClaims>; redirectTo: string }> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const session = await RefreshSession.findOne({ tokenHash });

    if (!session) {
      throw unauthorized('Invalid refresh token');
    }

    // Reuse of a rotated/revoked token → revoke entire family (theft signal)
    if (session.revokedAt || session.replacedBySid) {
      await RefreshSession.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      console.warn('[auth] Refresh token reuse detected — family revoked', {
        familyId: session.familyId,
        userId: session.userId.toString(),
        sid: session.sid,
      });
      throw unauthorized(
        'Refresh token reuse detected. All sessions in this family were revoked. Please log in again.'
      );
    }

    if (session.expiresAt.getTime() < Date.now()) {
      session.revokedAt = new Date();
      await session.save();
      throw unauthorized('Refresh token expired. Please log in again.');
    }

    const uaHash = hashUserAgent(meta.userAgent);
    if (
      session.userAgentHash &&
      uaHash &&
      session.userAgentHash !== uaHash
    ) {
      console.warn('[auth] Refresh userAgent mismatch', {
        userId: session.userId.toString(),
        sid: session.sid,
      });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      await RefreshSession.updateMany(
        { familyId: session.familyId },
        { $set: { revokedAt: new Date() } }
      );
      throw unauthorized('User not found');
    }

    assertUserCanHoldSession(user);

    const next = await this.issueTokenPair(user, meta, session.familyId);

    // Decode new access to get new sid — issued pair embeds new sid in JWT;
    // look up the new session by refresh token hash.
    const newHash = hashRefreshToken(next.refreshToken);
    const newSession = await RefreshSession.findOne({ tokenHash: newHash });

    session.revokedAt = new Date();
    session.replacedBySid = newSession?.sid ?? null;
    await session.save();

    return next;
  }

  async revokeSessionBySid(sid: string, userId: string): Promise<void> {
    await RefreshSession.updateMany(
      {
        sid,
        userId: new Types.ObjectId(userId),
        revokedAt: null,
      },
      { $set: { revokedAt: new Date() } }
    );
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const result = await RefreshSession.updateMany(
      {
        userId: new Types.ObjectId(userId),
        revokedAt: null,
      },
      { $set: { revokedAt: new Date() } }
    );
    return result.modifiedCount;
  }
}

export const tokenService = new TokenService();
