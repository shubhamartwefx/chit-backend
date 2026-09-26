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
  listUsersQuerySchema,
  userIdParamsSchema,
  userStatusActionSchema,
} from './super-admin.validation';
import { subscriptionPlanController } from '../subscription-plans/subscription-plan.controller';
import {
  bulkUpsertSubscriptionPlansSchema,
  createSubscriptionPlanSchema,
  listSubscriptionPlansQuerySchema,
  subscriptionPlanIdParamsSchema,
  updateSubscriptionPlanSchema,
} from '../subscription-plans/subscription-plan.validation';
import { tutorialController } from '../tutorials/tutorial.controller';
import {
  createTutorialSchema,
  listTutorialsQuerySchema,
  tutorialIdParamsSchema,
  updateTutorialSchema,
} from '../tutorials/tutorial.validation';

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
  validate(listUsersQuerySchema, 'query'),
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
  validate(listUsersQuerySchema, 'query'),
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
  validate(listUsersQuerySchema, 'query'),
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
  validate(listUsersQuerySchema, 'query'),
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
  validate(listUsersQuerySchema, 'query'),
  (req, res, next) => superAdminController.listAdmins(req, res, next)
);

router.post(
  '/users/:userId/block',
  authorizeIf(canCreateBranchStoreUser),
  validate(userIdParamsSchema, 'params'),
  validate(userStatusActionSchema),
  (req, res, next) => superAdminController.blockUser(req, res, next)
);

router.post(
  '/users/:userId/unblock',
  authorizeIf(canCreateBranchStoreUser),
  validate(userIdParamsSchema, 'params'),
  validate(userStatusActionSchema),
  (req, res, next) => superAdminController.unblockUser(req, res, next)
);

router.get(
  '/subscription-plans',
  authorizeIf(canListPlatformUsers),
  validate(listSubscriptionPlansQuerySchema, 'query'),
  (req, res, next) => subscriptionPlanController.list(req, res, next)
);

router.post(
  '/subscription-plans',
  authorizeIf(canCreateBranchStoreUser),
  validate(createSubscriptionPlanSchema),
  (req, res, next) => subscriptionPlanController.create(req, res, next)
);

router.put(
  '/subscription-plans',
  authorizeIf(canCreateBranchStoreUser),
  validate(bulkUpsertSubscriptionPlansSchema),
  (req, res, next) => subscriptionPlanController.bulkUpsert(req, res, next)
);

router.patch(
  '/subscription-plans/:id',
  authorizeIf(canCreateBranchStoreUser),
  validate(subscriptionPlanIdParamsSchema, 'params'),
  validate(updateSubscriptionPlanSchema),
  (req, res, next) => subscriptionPlanController.update(req, res, next)
);

router.delete(
  '/subscription-plans/:id',
  authorizeIf(canCreateBranchStoreUser),
  validate(subscriptionPlanIdParamsSchema, 'params'),
  (req, res, next) => subscriptionPlanController.remove(req, res, next)
);

router.get(
  '/tutorials',
  authorizeIf(canListPlatformUsers),
  validate(listTutorialsQuerySchema, 'query'),
  (req, res, next) => tutorialController.list(req, res, next)
);

router.post(
  '/tutorials',
  authorizeIf(canCreateBranchStoreUser),
  validate(createTutorialSchema),
  (req, res, next) => tutorialController.create(req, res, next)
);

router.get(
  '/tutorials/:id',
  authorizeIf(canListPlatformUsers),
  validate(tutorialIdParamsSchema, 'params'),
  (req, res, next) => tutorialController.getById(req, res, next)
);

router.patch(
  '/tutorials/:id',
  authorizeIf(canCreateBranchStoreUser),
  validate(tutorialIdParamsSchema, 'params'),
  validate(updateTutorialSchema),
  (req, res, next) => tutorialController.update(req, res, next)
);

router.delete(
  '/tutorials/:id',
  authorizeIf(canCreateBranchStoreUser),
  validate(tutorialIdParamsSchema, 'params'),
  (req, res, next) => tutorialController.remove(req, res, next)
);

export default router;
