import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { API_STATUS } from '../../common/status';
import { validate } from '../../middlewares/validate';
import { signupPaymentController } from './signup-payment.controller';
import {
  confirmPaymentSchema,
  createOrderSchema,
  orderIdParamSchema,
} from './signup-payment.validation';

const router = Router();

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: API_STATUS.RATE_LIMITED.message,
    code: API_STATUS.RATE_LIMITED.code,
  },
});

router.post(
  '/create-order',
  paymentLimiter,
  validate(createOrderSchema),
  (req, res, next) => signupPaymentController.createOrder(req, res, next)
);

router.post(
  '/confirm',
  paymentLimiter,
  validate(confirmPaymentSchema),
  (req, res, next) => signupPaymentController.confirm(req, res, next)
);

router.get(
  '/:orderId',
  paymentLimiter,
  validate(orderIdParamSchema, 'params'),
  (req, res, next) => signupPaymentController.getOrder(req, res, next)
);

export default router;
