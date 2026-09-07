import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { API_STATUS } from '../../common/status';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import agentSignupRoutes from '../agent-signup/agent-signup.routes';
import bidderSignupRoutes from '../bidder-signup/bidder-signup.routes';
import { authController } from './auth.controller';
import {
  refreshTokenSchema,
  requestOtpSchema,
  roleParamSchema,
  securityConfigureSchema,
  securityUnlockSchema,
  verify2faSchema,
  verifyOtpSchema,
} from './auth.validation';

const router = Router();

const otpLimiter = rateLimit({
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

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: API_STATUS.RATE_LIMITED.message,
    code: API_STATUS.RATE_LIMITED.code,
  },
});

router.use('/bidder/register', bidderSignupRoutes);
router.use('/agent/register', agentSignupRoutes);

router.post(
  '/refresh',
  refreshLimiter,
  validate(refreshTokenSchema),
  (req, res, next) => authController.refresh(req, res, next)
);

router.get('/me', authenticate, (req, res, next) =>
  authController.me(req, res, next)
);

router.post('/logout', authenticate, (req, res, next) =>
  authController.logout(req, res, next)
);

router.post('/logout-all', authenticate, (req, res, next) =>
  authController.logoutAll(req, res, next)
);

router.get('/security', authenticate, (req, res, next) =>
  authController.securityStatus(req, res, next)
);

router.post(
  '/security',
  authenticate,
  validate(securityConfigureSchema),
  (req, res, next) => authController.securityConfigure(req, res, next)
);

router.post(
  '/security/unlock',
  authenticate,
  validate(securityUnlockSchema),
  (req, res, next) => authController.securityUnlock(req, res, next)
);

router.post(
  '/:role/request-otp',
  otpLimiter,
  validate(roleParamSchema, 'params'),
  validate(requestOtpSchema),
  (req, res, next) => authController.requestOtp(req, res, next)
);

router.post(
  '/:role/verify-otp',
  otpLimiter,
  validate(roleParamSchema, 'params'),
  validate(verifyOtpSchema),
  (req, res, next) => authController.verifyOtp(req, res, next)
);

router.post(
  '/:role/verify-2fa',
  otpLimiter,
  validate(roleParamSchema, 'params'),
  validate(verify2faSchema),
  (req, res, next) => authController.verify2fa(req, res, next)
);

export default router;
