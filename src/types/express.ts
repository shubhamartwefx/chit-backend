import { UserRole } from '../config/roles';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  permissions: string[];
  phone: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
