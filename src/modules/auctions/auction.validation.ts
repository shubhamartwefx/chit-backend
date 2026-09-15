import { z } from 'zod';
import { AUCTION_ROUND_STATUS } from './auction.model';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

export const createAuctionRoundSchema = z
  .object({
    roundNumber: z.coerce.number().int().min(1).max(240),
    monthNumber: z.coerce.number().int().min(1).max(240),
    opensAt: z.coerce.date(),
    closesAt: z.coerce.date(),
  })
  .refine((data) => data.closesAt > data.opensAt, {
    message: 'closesAt must be after opensAt',
    path: ['closesAt'],
  });

export type CreateAuctionRoundInput = z.infer<typeof createAuctionRoundSchema>;

export const placeBidSchema = z.object({
  amount: z.coerce.number().positive(),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;

export const closeAuctionRoundSchema = z.object({
  winnerBidderId: objectIdSchema.optional(),
});

export type CloseAuctionRoundInput = z.infer<typeof closeAuctionRoundSchema>;

export const auctionRoundParamsSchema = z.object({
  id: objectIdSchema,
  roundId: objectIdSchema,
});

export type AuctionRoundParams = z.infer<typeof auctionRoundParamsSchema>;

export const listAuctionRoundsQuerySchema = z.object({
  status: z
    .enum([
      AUCTION_ROUND_STATUS.OPEN,
      AUCTION_ROUND_STATUS.CLOSED,
      AUCTION_ROUND_STATUS.CANCELLED,
    ])
    .optional(),
});

export type ListAuctionRoundsQueryInput = z.infer<
  typeof listAuctionRoundsQuerySchema
>;
