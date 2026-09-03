import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { API_STATUS } from '../../common/status';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { authController } from './auth.controller';
import {
  requestOtpSchema,
  roleParamSchema,
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

router.get('/me', authenticate, (req, res, next) =>
  authController.me(req, res, next)
);

router.post('/logout', authenticate, (req, res, next) =>
  authController.logout(req, res, next)
);

export default router;
