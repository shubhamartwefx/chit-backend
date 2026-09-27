import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizePermission,
} from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { sendSuccess } from '../../common/response';
import { branchStoreController } from './branch-store.controller';
import {
  createOperatorBidderSchema,
  listOperatorAgentsQuerySchema,
  listOperatorBiddersQuerySchema,
} from '../operator-bidders/operator-bidder.validation';
import { tutorialController } from '../tutorials/tutorial.controller';
import {
  listTutorialsQuerySchema,
  tutorialIdParamsSchema,
} from '../tutorials/tutorial.validation';

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
  validate(listOperatorAgentsQuerySchema, 'query'),
  (req, res, next) => branchStoreController.listAgents(req, res, next)
);

router.get(
  '/bidders',
  authorizePermission(PERMISSIONS.BIDDERS.READ),
  validate(listOperatorBiddersQuerySchema, 'query'),
  (req, res, next) => branchStoreController.listBidders(req, res, next)
);

router.post(
  '/bidders',
  authorizePermission(PERMISSIONS.BIDDERS.WRITE),
  validate(createOperatorBidderSchema),
  (req, res, next) => branchStoreController.createBidder(req, res, next)
);

router.get(
  '/tutorials',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(listTutorialsQuerySchema, 'query'),
  (req, res, next) => tutorialController.list(req, res, next)
);

router.get(
  '/tutorials/:id',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(tutorialIdParamsSchema, 'params'),
  (req, res, next) => tutorialController.getById(req, res, next)
);

export default router;
