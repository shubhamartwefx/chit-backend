import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccess, sendSuccessWithKey } from '../../common/response';
import { RoleUrlSlug } from '../../config/roles';
import { authService } from './auth.service';
import {
  RefreshTokenInput,
  RequestOtpInput,
  Verify2faInput,
  VerifyOtpInput,
} from './auth.validation';
import {
  securityService,
  type SecurityConfigureInput,
  type SecurityUnlockInput,
} from './security.service';

function requestMeta(req: Request) {
  return {
    userAgent: req.get('user-agent') ?? undefined,
    ip: req.ip,
  };
}

export class AuthController {
  async requestOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.params.role as RoleUrlSlug;
      const data = await authService.requestOtp(
        role,
        req.body as RequestOtpInput
      );
      sendSuccess(res, data, data.message ?? API_MESSAGES.OTP_SENT);
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.params.role as RoleUrlSlug;
      const data = await authService.verifyOtp(
        role,
        req.body as VerifyOtpInput,
        requestMeta(req)
      );
      sendSuccess(res, data, API_MESSAGES.LOGIN_SUCCESS);
    } catch (err) {
      next(err);
    }
  }

  async verify2fa(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.params.role as RoleUrlSlug;
      const data = await authService.verify2fa(
        role,
        req.body as Verify2faInput,
        requestMeta(req)
      );
      sendSuccess(res, data, API_MESSAGES.LOGIN_SUCCESS);
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      const data = await authService.refresh(refreshToken, requestMeta(req));
      sendSuccess(res, data, API_MESSAGES.TOKEN_REFRESHED);
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await authService.me(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await authService.logout(req.user!.sub, req.user!.sid);
      sendSuccess(res, data, API_MESSAGES.LOGOUT_SUCCESS);
    } catch (err) {
      next(err);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await authService.logoutAll(req.user!.sub);
      sendSuccess(res, data, API_MESSAGES.LOGOUT_ALL_SUCCESS);
    } catch (err) {
      next(err);
    }
  }

  async securityStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await securityService.status(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async securityConfigure(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await securityService.configure(
        req.user!.sub,
        req.body as SecurityConfigureInput
      );
      sendSuccess(res, data, API_MESSAGES.SECURITY_UPDATED);
    } catch (err) {
      next(err);
    }
  }

  async securityUnlock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await securityService.unlock(
        req.user!.sub,
        req.body as SecurityUnlockInput
      );
      sendSuccess(res, data, API_MESSAGES.SCREEN_UNLOCKED);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
