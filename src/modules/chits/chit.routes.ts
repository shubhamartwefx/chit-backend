import { Router } from 'express';
import { PERMISSIONS, USER_ROLES } from '../../config/roles';
import {
  authenticate,
  authorize,
  authorizePermission,
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
  chitIdParamsSchema as installmentChitIdParamsSchema,
  createInstallmentSchema,
  listInstallmentsQuerySchema,
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
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitIdParamsSchema, 'params'),
  validate(addChitMemberSchema),
  (req, res, next) => chitController.addMember(req, res, next)
);

router.patch(
  '/:id/members/:bidderId',
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(chitMemberParamsSchema, 'params'),
  validate(updateChitMemberSchema),
  (req, res, next) => chitController.updateMember(req, res, next)
);

router.delete(
  '/:id/members/:bidderId',
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
  authorize(...writeRoles),
  authorizePermission(PERMISSIONS.CHITS.WRITE),
  validate(installmentChitIdParamsSchema, 'params'),
  validate(createInstallmentSchema),
  (req, res, next) => installmentController.create(req, res, next)
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
  authorize(USER_ROLES.BIDDER),
  authorizePermission(PERMISSIONS.CHITS.READ),
  validate(auctionRoundParamsSchema, 'params'),
  validate(placeBidSchema),
  (req, res, next) => auctionController.placeBid(req, res, next)
);

router.post(
  '/:id/auction-rounds/:roundId/close',
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
