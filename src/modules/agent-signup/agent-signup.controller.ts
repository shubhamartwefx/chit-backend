import { NextFunction, Request, Response } from 'express';
import { API_MESSAGES } from '../../common/status';
import { sendSuccess, sendSuccessWithKey } from '../../common/response';
import { env } from '../../config/env';
import { agentSignupService } from './agent-signup.service';
import {
  CompleteRegistrationInput,
  DigilockerCallbackQuery,
  RequestAadhaarOtpInput,
  SessionIdBody,
  VerifyAadhaarOtpInput,
} from './agent-signup.validation';

export class AgentSignupController {
  async requestAadhaarOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSignupService.requestAadhaarOtp(
        req.body as RequestAadhaarOtpInput
      );
      sendSuccess(res, data, data.message ?? API_MESSAGES.OTP_SENT);
    } catch (err) {
      next(err);
    }
  }

  async resendAadhaarOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.body as SessionIdBody;
      const data = await agentSignupService.resendAadhaarOtp(sessionId);
      sendSuccess(res, data, data.message ?? API_MESSAGES.OTP_SENT);
    } catch (err) {
      next(err);
    }
  }

  async verifyAadhaarOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSignupService.verifyAadhaarOtp(
        req.body as VerifyAadhaarOtpInput
      );
      sendSuccess(res, data, API_MESSAGES.AADHAAR_VERIFIED);
    } catch (err) {
      next(err);
    }
  }

  async startDigiLocker(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSignupService.startDigiLocker();
      sendSuccess(res, data, API_MESSAGES.DIGILOCKER_STARTED);
    } catch (err) {
      next(err);
    }
  }

  async digilockerCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSignupService.digilockerCallback(
        req.query as unknown as DigilockerCallbackQuery
      );

      const accept = req.get('Accept') ?? '';
      if (accept.includes('application/json')) {
        sendSuccess(res, data, API_MESSAGES.AADHAAR_VERIFIED);
        return;
      }

      const redirect = new URL(env.DIGILOCKER_AGENT_SUCCESS_REDIRECT_URL);
      redirect.searchParams.set('sessionId', data.sessionId);
      redirect.searchParams.set('status', data.status);
      res.redirect(302, redirect.toString());
    } catch (err) {
      next(err);
    }
  }

  async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSignupService.getSession(
        req.params.sessionId as string
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async completeRegistration(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await agentSignupService.completeRegistration(
        req.body as CompleteRegistrationInput,
        {
          userAgent: req.get('user-agent') ?? undefined,
          ip: req.ip,
        }
      );
      sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.AGENT_REGISTERED);
    } catch (err) {
      next(err);
    }
  }
}

export const agentSignupController = new AgentSignupController();
