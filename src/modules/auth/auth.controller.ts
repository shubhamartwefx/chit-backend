import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccess, sendSuccessWithKey } from '../../common/response';
import { RoleUrlSlug } from '../../config/roles';
import { authService } from './auth.service';
import { RequestOtpInput, VerifyOtpInput } from './auth.validation';

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
        req.body as VerifyOtpInput
      );
      sendSuccess(res, data, API_MESSAGES.LOGIN_SUCCESS);
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

  async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(
        res,
        { loggedOut: true },
        API_MESSAGES.LOGOUT_SUCCESS
      );
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
