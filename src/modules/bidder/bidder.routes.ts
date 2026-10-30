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
import { bidderController } from './bidder.controller';
import {
  chitIdParamsSchema,
  joinChitSchema,
} from '../chits/chit.validation';
import {
  reportAgentSchema,
  updateAgentReportSchema,
  agentReportIdParamsSchema,
  chitIdParamsSchema as agentReportChitParamsSchema,
} from '../agent-reports/agent-report.validation';
import { bidderSubscriptionController } from '../agent-subscriptions/agent-subscription.controller';
import {
  confirmAgentSubscriptionSchema,
  createAgentSubscriptionOrderSchema,
} from '../agent-subscriptions/agent-subscription.validation';
import { invoiceController } from '../invoices/invoice.controller';
import {
  invoiceIdParamsSchema,
  listInvoicesQuerySchema,
} from '../invoices/invoice.validation';

const router = Router();

router.use(authenticate, authorize(USER_ROLES.BIDDER));

router.get('/health', (_req, res) => {
  sendSuccess(res, { module: 'bidder', status: 'ready' }, 'Bidder module OK');
});

router.post(
  '/chits/:id/join',
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(chitIdParamsSchema, 'params'),
  validate(joinChitSchema),
  (req, res, next) => bidderController.joinChit(req, res, next)
);

router.post(
  '/chits/:id/report-agent',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.REPORTS.READ),
  validate(agentReportChitParamsSchema, 'params'),
  validate(reportAgentSchema),
  (req, res, next) => bidderController.reportAgent(req, res, next)
);

router.get(
  '/reports',
  authorizePermission(PERMISSIONS.REPORTS.READ),
  (req, res, next) => bidderController.listMyReports(req, res, next)
);

router.get(
  '/agent-reports',
  authorizePermission(PERMISSIONS.REPORTS.READ),
  (req, res, next) => bidderController.listMyAgentReports(req, res, next)
);

router.patch(
  '/agent-reports/:reportId',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.REPORTS.READ),
  validate(agentReportIdParamsSchema, 'params'),
  validate(updateAgentReportSchema),
  (req, res, next) => bidderController.updateMyAgentReport(req, res, next)
);

router.delete(
  '/agent-reports/:reportId',
  rejectIfBlocked,
  authorizePermission(PERMISSIONS.REPORTS.READ),
  validate(agentReportIdParamsSchema, 'params'),
  (req, res, next) => bidderController.deleteMyAgentReport(req, res, next)
);

router.get(
  '/subscription-plans',
  authorizePermission(PERMISSIONS.CHITS.READ),
  (req, res, next) => bidderController.listSubscriptionPlans(req, res, next)
);

router.get('/subscriptions', (req, res, next) =>
  bidderSubscriptionController.listHistory(req, res, next)
);

router.get('/subscriptions/current', (req, res, next) =>
  bidderSubscriptionController.getCurrent(req, res, next)
);

router.post(
  '/subscriptions/create-order',
  rejectIfBlocked,
  validate(createAgentSubscriptionOrderSchema),
  (req, res, next) => bidderSubscriptionController.createOrder(req, res, next)
);

router.post(
  '/subscriptions/confirm',
  rejectIfBlocked,
  validate(confirmAgentSubscriptionSchema),
  (req, res, next) => bidderSubscriptionController.confirm(req, res, next)
);

router.get(
  '/invoices',
  validate(listInvoicesQuerySchema, 'query'),
  (req, res, next) => invoiceController.listMine(req, res, next)
);

router.get(
  '/invoices/:id',
  validate(invoiceIdParamsSchema, 'params'),
  (req, res, next) => invoiceController.getMine(req, res, next)
);

export default router;
