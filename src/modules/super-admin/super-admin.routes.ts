import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { API_STATUS } from '../../common/status';
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
  canRevealSensitiveData,
} from '../../config/rbac';
import { superAdminController } from './super-admin.controller';
import {
  assignBidderAgentSchema,
  createAgentSchema,
  createBidderSchema,
  createBranchStoreSchema,
  createStaffSchema,
  listUsersQuerySchema,
  resourceIdParamsSchema,
  updateStaffPermissionsSchema,
  updateUserProfileSchema,
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
import { listOperatorReportsQuerySchema } from '../operator-bidders/operator-bidder.validation';
import { sensitiveDataController } from '../sensitive-data/sensitive-data.controller';
import { revealSensitiveFieldSchema } from '../sensitive-data/sensitive-data.validation';

const router = Router();

const REVEAL_WINDOW_MS = 15 * 60 * 1000;
const REVEAL_MAX_PER_WINDOW = 30;

/** Keyed per staff member (route runs after authenticate) to cap bulk harvesting. */
const revealLimiter = rateLimit({
  windowMs: REVEAL_WINDOW_MS,
  max: REVEAL_MAX_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub ?? req.ip ?? 'unknown',
  message: {
    success: false,
    message: API_STATUS.RATE_LIMITED.message,
    code: API_STATUS.RATE_LIMITED.code,
  },
});

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

router.get(
  '/branch-stores/:id',
  authorizeIf(canListPlatformUsers),
  validate(resourceIdParamsSchema, 'params'),
  (req, res, next) => superAdminController.getBranchStore(req, res, next)
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

router.get(
  '/agents/:id',
  authorizeIf(canListPlatformUsers),
  validate(resourceIdParamsSchema, 'params'),
  (req, res, next) => superAdminController.getAgent(req, res, next)
);

router.patch(
  '/agents/:id',
  authorizeIf(canCreateBranchStoreUser),
  validate(resourceIdParamsSchema, 'params'),
  validate(updateUserProfileSchema),
  (req, res, next) => superAdminController.updateAgent(req, res, next)
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

router.get(
  '/bidders/:id/reports',
  authorizeIf(canListPlatformUsers),
  validate(resourceIdParamsSchema, 'params'),
  (req, res, next) => superAdminController.listBidderReports(req, res, next)
);

router.patch(
  '/bidders/:id/assign-agent',
  authorizeIf(canCreateBranchStoreUser),
  validate(resourceIdParamsSchema, 'params'),
  validate(assignBidderAgentSchema),
  (req, res, next) => superAdminController.assignBidderToAgent(req, res, next)
);

router.get(
  '/bidders/:id',
  authorizeIf(canListPlatformUsers),
  validate(resourceIdParamsSchema, 'params'),
  (req, res, next) => superAdminController.getBidder(req, res, next)
);

router.patch(
  '/bidders/:id',
  authorizeIf(canCreateBranchStoreUser),
  validate(resourceIdParamsSchema, 'params'),
  validate(updateUserProfileSchema),
  (req, res, next) => superAdminController.updateBidder(req, res, next)
);

router.get(
  '/reports',
  authorizeIf(canListPlatformUsers),
  validate(listOperatorReportsQuerySchema, 'query'),
  (req, res, next) => superAdminController.listReports(req, res, next)
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

router.patch(
  '/staff/:userId/permissions',
  authorizeIf(canCreateSuperAdminStaff),
  validate(userIdParamsSchema, 'params'),
  validate(updateStaffPermissionsSchema),
  (req, res, next) => superAdminController.updateStaffPermissions(req, res, next)
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
  '/users/:userId/reveal',
  authorizeIf(
    canRevealSensitiveData,
    'You do not have permission to reveal this data'
  ),
  revealLimiter,
  validate(userIdParamsSchema, 'params'),
  validate(revealSensitiveFieldSchema),
  (req, res, next) => sensitiveDataController.reveal(req, res, next)
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
