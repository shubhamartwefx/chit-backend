import { Router } from 'express';
import { USER_ROLES } from '../../config/roles';
import { authenticate, authorize } from '../../middlewares/auth';
import { sendSuccess } from '../../common/response';

/** @deprecated Use branch-store module. Kept for FE/API backward compatibility. */
const router = Router();

router.use(authenticate, authorize(USER_ROLES.BRANCH_STORE));

router.get('/health', (_req, res) => {
  sendSuccess(
    res,
    { module: 'admin', status: 'ready', aliasOf: 'branch-store' },
    'Admin module OK (deprecated alias)'
  );
});

export default router;
