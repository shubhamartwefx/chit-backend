import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizePermission,
} from '../../middlewares/auth';
import { reportsController } from './reports.controller';

const router = Router();

const reportRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.BRANCH_STORE,
  USER_ROLES.AGENT,
] as const;

router.use(authenticate);

router.get(
  '/overview',
  authorize(...reportRoles),
  authorizePermission(PERMISSIONS.REPORTS.READ),
  (req, res, next) => reportsController.overview(req, res, next)
);

export default router;
