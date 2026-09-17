import { NextFunction, Request, Response } from 'express';
import { sendSuccess, sendSuccessWithKey } from '../../common/response';
import { signupPaymentService } from './signup-payment.service';
import {
  ConfirmPaymentInput,
  CreateOrderInput,
} from './signup-payment.validation';

export class SignupPaymentController {
  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await signupPaymentService.createOrder(
        req.body as CreateOrderInput
      );
      sendSuccess(res, data, 'Payment order created');
    } catch (err) {
      next(err);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await signupPaymentService.confirm(
        req.body as ConfirmPaymentInput
      );
      sendSuccess(res, data, 'Payment confirmed');
    } catch (err) {
      next(err);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await signupPaymentService.getOrder(
        req.params.orderId as string
      );
      sendSuccessWithKey(res, data, 'OK');
    } catch (err) {
      next(err);
    }
  }
}

export const signupPaymentController = new SignupPaymentController();
