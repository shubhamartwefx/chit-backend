import { Router } from 'express';
import { authenticate, rejectIfBlocked } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { userPreferencesController } from './user-preferences.controller';
import { updatePreferencesSchema } from './user-preferences.validation';

const router = Router();

router.get('/', authenticate, (req, res, next) =>
  userPreferencesController.get(req, res, next)
);

router.patch(
  '/',
  authenticate,
  rejectIfBlocked,
  validate(updatePreferencesSchema),
  (req, res, next) => userPreferencesController.update(req, res, next)
);

export default router;
