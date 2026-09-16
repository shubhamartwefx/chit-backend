import { UserRole, UserStatus } from '../config/roles';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  permissions: string[];
  phone: string;
  name: string;
  /** Unique access-token id */
  jti: string;
  /** Refresh session id */
  sid: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      accountStatus?: {
        status: UserStatus;
        statusReason?: string | null;
      };
    }
  }
}

export {};
