import { Router } from 'express';
import { USER_ROLES } from '../../config/roles';
import { authenticate, authorize } from '../../middlewares/auth';
import { sendSuccess } from '../../common/response';

const router = Router();

router.use(authenticate, authorize(USER_ROLES.BIDDER));

router.get('/health', (_req, res) => {
  sendSuccess(res, { module: 'bidder', status: 'ready' }, 'Bidder module OK');
});

export default router;
