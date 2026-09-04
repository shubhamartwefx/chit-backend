import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccess, sendSuccessWithKey } from '../../common/response';
import { RoleUrlSlug } from '../../config/roles';
import { authService } from './auth.service';
import { biometricService } from './biometric.service';
import {
  RefreshTokenInput,
  RequestOtpInput,
  Verify2faInput,
  VerifyOtpInput,
} from './auth.validation';
import { screenLockService, twoFaService } from './two-fa.service';

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

  async twoFaStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await twoFaService.status(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async twoFaSetup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await twoFaService.setup(req.user!.sub);
      sendSuccess(res, data, API_MESSAGES.TWO_FA_SETUP);
    } catch (err) {
      next(err);
    }
  }

  async twoFaConfirm(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await twoFaService.confirm(req.user!.sub, req.body.totp);
      sendSuccess(res, data, API_MESSAGES.TWO_FA_ENABLED);
    } catch (err) {
      next(err);
    }
  }

  async twoFaDisable(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await twoFaService.disable(req.user!.sub, req.body.totp);
      sendSuccess(res, data, API_MESSAGES.TWO_FA_DISABLED);
    } catch (err) {
      next(err);
    }
  }

  async screenLockStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await screenLockService.status(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async screenLockSetPin(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await screenLockService.setPin(req.user!.sub, req.body);
      sendSuccess(res, data, API_MESSAGES.SCREEN_LOCK_UPDATED);
    } catch (err) {
      next(err);
    }
  }

  async screenLockEnable(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await screenLockService.enable(
        req.user!.sub,
        req.body.enabled
      );
      sendSuccess(res, data, API_MESSAGES.SCREEN_LOCK_UPDATED);
    } catch (err) {
      next(err);
    }
  }

  async screenLockUnlock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await screenLockService.unlock(req.user!.sub, req.body);
      sendSuccess(res, data, API_MESSAGES.SCREEN_UNLOCKED);
    } catch (err) {
      next(err);
    }
  }

  async biometricStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await biometricService.status(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async biometricRegisterOptions(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await biometricService.registerOptions(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async biometricRegisterVerify(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await biometricService.registerVerify(
        req.user!.sub,
        req.body
      );
      sendSuccess(res, data, API_MESSAGES.BIOMETRIC_UPDATED);
    } catch (err) {
      next(err);
    }
  }

  async biometricAuthOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await biometricService.authenticateOptions(req.user!.sub);
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async biometricAuthVerify(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await biometricService.authenticateVerify(
        req.user!.sub,
        req.body
      );
      sendSuccess(res, data, API_MESSAGES.SCREEN_UNLOCKED);
    } catch (err) {
      next(err);
    }
  }

  async biometricDisable(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await biometricService.disable(req.user!.sub);
      sendSuccess(res, data, API_MESSAGES.BIOMETRIC_UPDATED);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
