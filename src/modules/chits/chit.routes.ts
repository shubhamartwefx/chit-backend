import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizePermission,
} from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { chitController } from './chit.controller';
import {
  chitIdParamsSchema,
  createChitSchema,
  listChitsQuerySchema,
  summaryQuerySchema,
  updateChitSchema,
} from './chit.validation';

const router = Router();

const readRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.BRANCH_STORE,
  USER_ROLES.AGENT,
  USER_ROLES.BIDDER,
] as const;

const writeRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.BRANCH_STORE,
  USER_ROLES.AGENT,
] as const;

router.use(authenticate);

router.get(
  '/',
  authorize(...readRoles),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(listChitsQuerySchema, 'query'),
  (req, res, next) => chitController.list(req, res, next)
);

router.get(
  '/summary',
  authorize(...readRoles),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(summaryQuerySchema, 'query'),
  (req, res, next) => chitController.summary(req, res, next)
);

router.get(
  '/:id',
  authorize(...readRoles),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(chitIdParamsSchema, 'params'),
  (req, res, next) => chitController.getById(req, res, next)
);

router.post(
  '/',
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(createChitSchema),
  (req, res, next) => chitController.create(req, res, next)
);

router.patch(
  '/:id',
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitIdParamsSchema, 'params'),
  validate(updateChitSchema),
  (req, res, next) => chitController.update(req, res, next)
);

router.delete(
  '/:id',
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitIdParamsSchema, 'params'),
  (req, res, next) => chitController.remove(req, res, next)
);

export default router;
