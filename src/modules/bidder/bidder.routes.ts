import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizePermission,
} from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { sendSuccess } from '../../common/response';
import { bidderController } from './bidder.controller';
import {
  chitIdParamsSchema,
  joinChitSchema,
} from '../chits/chit.validation';

const router = Router();

router.use(authenticate, authorize(USER_ROLES.BIDDER));

router.get('/health', (_req, res) => {
  sendSuccess(res, { module: 'bidder', status: 'ready' }, 'Bidder module OK');
});

router.post(
  '/chits/:id/join',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(chitIdParamsSchema, 'params'),
  validate(joinChitSchema),
  (req, res, next) => bidderController.joinChit(req, res, next)
);

export default router;
