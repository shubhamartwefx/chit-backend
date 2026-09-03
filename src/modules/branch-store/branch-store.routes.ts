import { Router } from 'express';
import { USER_ROLES } from '../../config/roles';
import { authenticate, authorize } from '../../middlewares/auth';
import { sendSuccess } from '../../common/response';

const router = Router();

router.use(authenticate, authorize(USER_ROLES.BRANCH_STORE));

/** Scaffold — domain APIs land here later. */
router.get('/health', (_req, res) => {
  sendSuccess(
    res,
    { module: 'branch-store', status: 'ready' },
    'Branch Store module OK'
  );
});

export default router;
