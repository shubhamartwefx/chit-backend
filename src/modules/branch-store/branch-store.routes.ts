import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizePermission,
} from '../../middlewares/auth';
import { sendSuccess } from '../../common/response';
import { branchStoreController } from './branch-store.controller';

const router = Router();

router.use(authenticate, authorize(USER_ROLES.BRANCH_STORE));

router.get('/health', (_req, res) => {
  sendSuccess(
    res,
    { module: 'branch-store', status: 'ready' },
    'Branch Store module OK'
  );
});

router.get(
  '/agents',
  authorizePermission(PERMISSIONS.AGENTS.READ),
  (req, res, next) => branchStoreController.listAgents(req, res, next)
);

export default router;
