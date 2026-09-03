import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizeIf,
} from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  canCreateBranchStoreUser,
  canCreateSuperAdminStaff,
  canListPlatformUsers,
} from '../../config/rbac';
import { superAdminController } from './super-admin.controller';
import {
  createAgentSchema,
  createBidderSchema,
  createBranchStoreSchema,
  createStaffSchema,
} from './super-admin.validation';

const router = Router();

router.use(authenticate, authorize(USER_ROLES.SUPER_ADMIN));

router.get('/permissions', (req, res, next) =>
  superAdminController.getPermissionsCatalog(req, res, next)
);

router.post(
  '/branch-stores',
  authorizeIf(canCreateBranchStoreUser),
  validate(createBranchStoreSchema),
  (req, res, next) => superAdminController.createBranchStore(req, res, next)
);

router.get(
  '/branch-stores',
  authorizeIf(canListPlatformUsers),
  (req, res, next) => superAdminController.listBranchStores(req, res, next)
);

router.post(
  '/agents',
  authorizeIf(canCreateBranchStoreUser),
  validate(createAgentSchema),
  (req, res, next) => superAdminController.createAgent(req, res, next)
);

router.get(
  '/agents',
  authorizeIf(canListPlatformUsers),
  (req, res, next) => superAdminController.listAgents(req, res, next)
);

router.post(
  '/bidders',
  authorizeIf(canCreateBranchStoreUser),
  validate(createBidderSchema),
  (req, res, next) => superAdminController.createBidder(req, res, next)
);

router.get(
  '/bidders',
  authorizeIf(canListPlatformUsers),
  (req, res, next) => superAdminController.listBidders(req, res, next)
);

router.post(
  '/staff',
  authorizeIf(canCreateSuperAdminStaff),
  validate(createStaffSchema),
  (req, res, next) => superAdminController.createStaff(req, res, next)
);

router.get(
  '/staff',
  authorizeIf((perms) =>
    canListPlatformUsers(perms) &&
    (canCreateSuperAdminStaff(perms) ||
      perms.includes(PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER))
  ),
  (req, res, next) => superAdminController.listStaff(req, res, next)
);

/** @deprecated aliases — keep for backward compatibility */
router.post(
  '/admins',
  authorizeIf(canCreateBranchStoreUser),
  validate(createBranchStoreSchema),
  (req, res, next) => superAdminController.createAdmin(req, res, next)
);

router.get(
  '/admins',
  authorizeIf(canListPlatformUsers),
  (req, res, next) => superAdminController.listAdmins(req, res, next)
);

export default router;
