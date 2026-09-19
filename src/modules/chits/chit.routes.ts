import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizePermission,
  rejectIfBlocked,
} from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { auctionController } from '../auctions/auction.controller';
import {
  auctionRoundParamsSchema,
  closeAuctionRoundSchema,
  createAuctionRoundSchema,
  listAuctionRoundsQuerySchema,
  placeBidSchema,
} from '../auctions/auction.validation';
import { installmentController } from '../installments/installment.controller';
import {
  agentTakenMonthDetailSchema,
  bidderPaymentMonthDetailSchema,
  chitIdParamsSchema as installmentChitIdParamsSchema,
  createInstallmentSchema,
  installmentParamsSchema,
  listInstallmentsQuerySchema,
  skipMonthDetailSchema,
  updateInstallmentSchema,
} from '../installments/installment.validation';
import { chitController } from './chit.controller';
import {
  addChitMemberSchema,
  chitIdParamsSchema,
  chitMemberParamsSchema,
  createChitSchema,
  listChitsQuerySchema,
  summaryQuerySchema,
  updateChitMemberSchema,
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

router.post(
  '/:id/members',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitIdParamsSchema, 'params'),
  validate(addChitMemberSchema),
  (req, res, next) => chitController.addMember(req, res, next)
);

router.patch(
  '/:id/members/:bidderId',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitMemberParamsSchema, 'params'),
  validate(updateChitMemberSchema),
  (req, res, next) => chitController.updateMember(req, res, next)
);

router.delete(
  '/:id/members/:bidderId',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitMemberParamsSchema, 'params'),
  (req, res, next) => chitController.removeMember(req, res, next)
);

router.get(
  '/:id/installments',
  authorize(...readRoles),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(installmentChitIdParamsSchema, 'params'),
  validate(listInstallmentsQuerySchema, 'query'),
  (req, res, next) => installmentController.list(req, res, next)
);

router.post(
  '/:id/installments',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(installmentChitIdParamsSchema, 'params'),
  validate(createInstallmentSchema),
  (req, res, next) => installmentController.create(req, res, next)
);

router.get(
  '/:id/installments/:installmentId',
  authorize(...readRoles),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(installmentParamsSchema, 'params'),
  (req, res, next) => installmentController.getById(req, res, next)
);

router.patch(
  '/:id/installments/:installmentId',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(installmentParamsSchema, 'params'),
  validate(updateInstallmentSchema),
  (req, res, next) => installmentController.update(req, res, next)
);

router.post(
  '/:id/month-details/bidder-payment',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(installmentChitIdParamsSchema, 'params'),
  validate(bidderPaymentMonthDetailSchema),
  (req, res, next) => installmentController.createBidderPayment(req, res, next)
);

router.post(
  '/:id/month-details/agent-taken',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(installmentChitIdParamsSchema, 'params'),
  validate(agentTakenMonthDetailSchema),
  (req, res, next) => installmentController.createAgentTaken(req, res, next)
);

router.post(
  '/:id/month-details/skip',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(installmentChitIdParamsSchema, 'params'),
  validate(skipMonthDetailSchema),
  (req, res, next) => installmentController.createSkip(req, res, next)
);

router.get(
  '/:id/auction-rounds',
  authorize(...readRoles),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(chitIdParamsSchema, 'params'),
  validate(listAuctionRoundsQuerySchema, 'query'),
  (req, res, next) => auctionController.listRounds(req, res, next)
);

router.post(
  '/:id/auction-rounds',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitIdParamsSchema, 'params'),
  validate(createAuctionRoundSchema),
  (req, res, next) => auctionController.createRound(req, res, next)
);

router.get(
  '/:id/auction-rounds/:roundId',
  authorize(...readRoles),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(auctionRoundParamsSchema, 'params'),
  (req, res, next) => auctionController.getRound(req, res, next)
);

router.post(
  '/:id/auction-rounds/:roundId/bids',
  rejectIfBlocked,
  authorize(USER_ROLES.BIDDER),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(auctionRoundParamsSchema, 'params'),
  validate(placeBidSchema),
  (req, res, next) => auctionController.placeBid(req, res, next)
);

router.post(
  '/:id/auction-rounds/:roundId/close',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(auctionRoundParamsSchema, 'params'),
  validate(closeAuctionRoundSchema),
  (req, res, next) => auctionController.closeRound(req, res, next)
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
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(createChitSchema),
  (req, res, next) => chitController.create(req, res, next)
);

router.patch(
  '/:id',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitIdParamsSchema, 'params'),
  validate(updateChitSchema),
  (req, res, next) => chitController.update(req, res, next)
);

router.delete(
  '/:id',
  rejectIfBlocked,
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitIdParamsSchema, 'params'),
  (req, res, next) => chitController.remove(req, res, next)
);

export default router;
