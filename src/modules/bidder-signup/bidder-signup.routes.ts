import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { API_STATUS } from '../../common/status';
import { validate } from '../../middlewares/validate';
import { bidderSignupController } from './bidder-signup.controller';
import {
  completeRegistrationSchema,
  digilockerCallbackQuerySchema,
  requestAadhaarOtpSchema,
  sessionIdBodySchema,
  sessionIdParamSchema,
  verifyAadhaarOtpSchema,
} from './bidder-signup.validation';

const router = Router();

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: API_STATUS.RATE_LIMITED.message,
    code: API_STATUS.RATE_LIMITED.code,
  },
});

router.post(
  '/aadhaar/request-otp',
  signupLimiter,
  validate(requestAadhaarOtpSchema),
  (req, res, next) => bidderSignupController.requestAadhaarOtp(req, res, next)
);

router.post(
  '/aadhaar/resend-otp',
  signupLimiter,
  validate(sessionIdBodySchema),
  (req, res, next) => bidderSignupController.resendAadhaarOtp(req, res, next)
);

router.post(
  '/aadhaar/verify-otp',
  signupLimiter,
  validate(verifyAadhaarOtpSchema),
  (req, res, next) => bidderSignupController.verifyAadhaarOtp(req, res, next)
);

router.post(
  '/digilocker/start',
  signupLimiter,
  (req, res, next) => bidderSignupController.startDigiLocker(req, res, next)
);

router.get(
  '/digilocker/callback',
  signupLimiter,
  validate(digilockerCallbackQuerySchema, 'query'),
  (req, res, next) => bidderSignupController.digilockerCallback(req, res, next)
);

router.get(
  '/session/:sessionId',
  signupLimiter,
  validate(sessionIdParamSchema, 'params'),
  (req, res, next) => bidderSignupController.getSession(req, res, next)
);

router.post(
  '/complete',
  signupLimiter,
  validate(completeRegistrationSchema),
  (req, res, next) =>
    bidderSignupController.completeRegistration(req, res, next)
);

export default router;
