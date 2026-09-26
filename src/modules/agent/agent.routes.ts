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
  listOperatorReportsQuerySchema,
  operatorBidderIdParamsSchema,
  updateOperatorBidderSchema,
} from '../operator-bidders/operator-bidder.validation';
import { promotionPdfController } from '../promotion-pdfs/promotion-pdf.controller';
import {
  createPromotionPdfSchema,
  listPromotionPdfsQuerySchema,
  promotionPdfIdParamsSchema,
  updatePromotionPdfSchema,
} from '../promotion-pdfs/promotion-pdf.validation';
import { subscriptionPlanController } from '../subscription-plans/subscription-plan.controller';
import { listSubscriptionPlansQuerySchema } from '../subscription-plans/subscription-plan.validation';
import { tutorialController } from '../tutorials/tutorial.controller';
import {
  listTutorialsQuerySchema,
  tutorialIdParamsSchema,
} from '../tutorials/tutorial.validation';
import { calendarEventController } from '../calendar-events/calendar-event.controller';
import {
  calendarEventIdParamsSchema,
  createCalendarEventSchema,
  listCalendarEventsQuerySchema,
  updateCalendarEventSchema,
} from '../calendar-events/calendar-event.validation';

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

router.patch(
  '/bidders/:id',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.BIDDERS.WRITE),
  validate(operatorBidderIdParamsSchema, 'params'),
  validate(updateOperatorBidderSchema),
  (req, res, next) => agentController.updateBidder(req, res, next)
);

router.get(
  '/bidders/:id/reports',
  authorizePermission(PERMISSIONS.BIDDERS.READ),
  validate(operatorBidderIdParamsSchema, 'params'),
  (req, res, next) => agentController.listBidderReports(req, res, next)
);

router.get(
  '/bidders/:id',
  authorizePermission(PERMISSIONS.BIDDERS.READ),
  validate(operatorBidderIdParamsSchema, 'params'),
  (req, res, next) => agentController.getBidder(req, res, next)
);

router.get(
  '/reports',
  authorizePermission(PERMISSIONS.REPORTS.READ),
  validate(listOperatorReportsQuerySchema, 'query'),
  (req, res, next) => agentController.listReports(req, res, next)
);

router.get(
  '/subscription-plans',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(listSubscriptionPlansQuerySchema, 'query'),
  (req, res, next) => subscriptionPlanController.list(req, res, next)
);

router.get(
  '/pdfs',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(listPromotionPdfsQuerySchema, 'query'),
  (req, res, next) => promotionPdfController.list(req, res, next)
);

router.post(
  '/pdfs',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(createPromotionPdfSchema),
  (req, res, next) => promotionPdfController.create(req, res, next)
);

router.get(
  '/pdfs/:id',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(promotionPdfIdParamsSchema, 'params'),
  (req, res, next) => promotionPdfController.getById(req, res, next)
);

router.patch(
  '/pdfs/:id',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(promotionPdfIdParamsSchema, 'params'),
  validate(updatePromotionPdfSchema),
  (req, res, next) => promotionPdfController.update(req, res, next)
);

router.delete(
  '/pdfs/:id',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(promotionPdfIdParamsSchema, 'params'),
  (req, res, next) => promotionPdfController.remove(req, res, next)
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

router.get(
  '/calendar-events',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(listCalendarEventsQuerySchema, 'query'),
  (req, res, next) => calendarEventController.list(req, res, next)
);

router.post(
  '/calendar-events',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(createCalendarEventSchema),
  (req, res, next) => calendarEventController.create(req, res, next)
);

router.get(
  '/calendar-events/:id',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(calendarEventIdParamsSchema, 'params'),
  (req, res, next) => calendarEventController.getById(req, res, next)
);

router.patch(
  '/calendar-events/:id',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(calendarEventIdParamsSchema, 'params'),
  validate(updateCalendarEventSchema),
  (req, res, next) => calendarEventController.update(req, res, next)
);

router.delete(
  '/calendar-events/:id',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(calendarEventIdParamsSchema, 'params'),
  (req, res, next) => calendarEventController.remove(req, res, next)
);

export default router;
