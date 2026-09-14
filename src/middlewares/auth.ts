import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { assertAccountCanAuthenticate } from '../common/account-status';
import {
  accessDenied,
  insufficientPermissions,
  unauthorized,
} from '../common/errors';
import { Permission, UserRole } from '../config/constants';
import {
  hasAllPermissions,
  hasAnyPermission,
} from '../config/rbac';
import { env } from '../config/env';
import { JwtPayload } from '../types/express';
import { User } from '../modules/users/user.model';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Missing or invalid Authorization header'));
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const account = await User.findById(decoded.sub)
      .select('status statusReason')
      .lean();

    if (!account) {
      next(unauthorized('Invalid or expired token'));
      return;
    }

    assertAccountCanAuthenticate(account);
    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(
        accessDenied(
          'You are not authorized to access this resource for your role'
        )
      );
      return;
    }
    next();
  };
}

/** Require ALL listed permissions (AND logic). */
export function authorizePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }

    const userPermissions = req.user.permissions ?? [];

    if (!hasAllPermissions(userPermissions, required)) {
      console.warn('[auth] Permission denied', {
        userId: req.user.sub,
        role: req.user.role,
        required,
        actual: userPermissions,
        path: req.path,
        method: req.method,
      });
      next(insufficientPermissions());
      return;
    }

    next();
  };
}

/** Require ANY listed permission (OR logic). */
export function authorizeAnyPermission(...options: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }

    const userPermissions = req.user.permissions ?? [];

    if (!hasAnyPermission(userPermissions, options)) {
      console.warn('[auth] Permission denied (any)', {
        userId: req.user.sub,
        role: req.user.role,
        requiredAny: options,
        actual: userPermissions,
        path: req.path,
        method: req.method,
      });
      next(insufficientPermissions());
      return;
    }

    next();
  };
}

/** Gate handler — caller must pass a predicate over JWT permissions. */
export function authorizeIf(
  check: (permissions: readonly string[]) => boolean,
  message = 'Insufficient permissions for this action'
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }

    if (!check(req.user.permissions ?? [])) {
      console.warn('[auth] Custom permission check failed', {
        userId: req.user.sub,
        role: req.user.role,
        path: req.path,
        method: req.method,
      });
      next(insufficientPermissions(message));
      return;
    }

    next();
  };
}
