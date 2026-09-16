import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizePermission,
  rejectIfBlocked,
} from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { sendSuccess } from '../../common/response';
import { agentController } from './agent.controller';
import {
  createOperatorBidderSchema,
  listOperatorBiddersQuerySchema,
  operatorBidderIdParamsSchema,
  operatorBidderStatusActionSchema,
} from '../operator-bidders/operator-bidder.validation';

const router = Router();

router.use(authenticate, authorize(USER_ROLES.AGENT));

router.get('/health', (_req, res) => {
  sendSuccess(res, { module: 'agent', status: 'ready' }, 'Agent module OK');
});

router.get(
  '/bidders',
  authorizePermission(PERMISSIONS.BIDDERS.READ),
  validate(listOperatorBiddersQuerySchema, 'query'),
  (req, res, next) => agentController.listBidders(req, res, next)
);

router.post(
  '/bidders',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.BIDDERS.WRITE),
  validate(createOperatorBidderSchema),
  (req, res, next) => agentController.createBidder(req, res, next)
);

router.post(
  '/bidders/:id/block',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.BIDDERS.WRITE),
  validate(operatorBidderIdParamsSchema, 'params'),
  validate(operatorBidderStatusActionSchema),
  (req, res, next) => agentController.blockBidder(req, res, next)
);

router.post(
  '/bidders/:id/unblock',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.BIDDERS.WRITE),
  validate(operatorBidderIdParamsSchema, 'params'),
  validate(operatorBidderStatusActionSchema),
  (req, res, next) => agentController.unblockBidder(req, res, next)
);

export default router;
