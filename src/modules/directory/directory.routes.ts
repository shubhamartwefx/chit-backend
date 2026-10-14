import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { API_STATUS } from '../../common/status';
import { USER_ROLES } from '../../config/roles';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { directoryController } from './directory.controller';
import {
  directorySearchQuerySchema,
  directoryUserIdParamsSchema,
} from './directory.validation';

const router = Router();

const SEARCH_WINDOW_MS = 15 * 60 * 1000;
const SEARCH_MAX_PER_WINDOW = 60;

/** Keyed per user (runs after authenticate) so phone numbers can't be enumerated in bulk. */
const searchLimiter = rateLimit({
  windowMs: SEARCH_WINDOW_MS,
  max: SEARCH_MAX_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub ?? req.ip ?? 'unknown',
  message: {
    success: false,
    message: API_STATUS.RATE_LIMITED.message,
    code: API_STATUS.RATE_LIMITED.code,
  },
});

router.use(authenticate);

router.get(
  '/search',
  authorize(USER_ROLES.AGENT, USER_ROLES.BIDDER, USER_ROLES.BRANCH_STORE),
  searchLimiter,
  validate(directorySearchQuerySchema, 'query'),
  (req, res, next) => directoryController.search(req, res, next)
);

router.get(
  '/bidders/:id/reports',
  authorize(USER_ROLES.AGENT, USER_ROLES.BRANCH_STORE),
  validate(directoryUserIdParamsSchema, 'params'),
  (req, res, next) => directoryController.listBidderReports(req, res, next)
);

export default router;
