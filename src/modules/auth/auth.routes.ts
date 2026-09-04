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
  screenLockEnableSchema,
  screenLockUnlockSchema,
  setPinSchema,
  totpConfirmSchema,
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

router.get('/2fa/status', authenticate, (req, res, next) =>
  authController.twoFaStatus(req, res, next)
);
router.post('/2fa/setup', authenticate, (req, res, next) =>
  authController.twoFaSetup(req, res, next)
);
router.post(
  '/2fa/confirm',
  authenticate,
  validate(totpConfirmSchema),
  (req, res, next) => authController.twoFaConfirm(req, res, next)
);
router.post(
  '/2fa/disable',
  authenticate,
  validate(totpConfirmSchema),
  (req, res, next) => authController.twoFaDisable(req, res, next)
);

router.get('/screen-lock/status', authenticate, (req, res, next) =>
  authController.screenLockStatus(req, res, next)
);
router.post(
  '/screen-lock/pin',
  authenticate,
  validate(setPinSchema),
  (req, res, next) => authController.screenLockSetPin(req, res, next)
);
router.post(
  '/screen-lock/enable',
  authenticate,
  validate(screenLockEnableSchema),
  (req, res, next) => authController.screenLockEnable(req, res, next)
);
router.post(
  '/screen-lock/unlock',
  authenticate,
  validate(screenLockUnlockSchema),
  (req, res, next) => authController.screenLockUnlock(req, res, next)
);

router.get('/biometric/status', authenticate, (req, res, next) =>
  authController.biometricStatus(req, res, next)
);
router.post('/biometric/register/options', authenticate, (req, res, next) =>
  authController.biometricRegisterOptions(req, res, next)
);
router.post('/biometric/register/verify', authenticate, (req, res, next) =>
  authController.biometricRegisterVerify(req, res, next)
);
router.post('/biometric/authenticate/options', authenticate, (req, res, next) =>
  authController.biometricAuthOptions(req, res, next)
);
router.post('/biometric/authenticate/verify', authenticate, (req, res, next) =>
  authController.biometricAuthVerify(req, res, next)
);
router.post('/biometric/disable', authenticate, (req, res, next) =>
  authController.biometricDisable(req, res, next)
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
