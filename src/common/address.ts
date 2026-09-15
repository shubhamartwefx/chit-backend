import { z } from 'zod';
import type { IAadhaarAddress } from '../modules/users/user.model';

/**
 * Structured address (same shape as aadhaarAddress).
 * `street` = Street / Area line.
 */
export const addressObjectSchema = z.object({
  street: z
    .string()
    .trim()
    .min(1, 'Street / Area is required')
    .max(200),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  country: z.string().trim().min(1).max(100).default('India'),
});

export type AddressObjectInput = z.infer<typeof addressObjectSchema>;

export function toStoredAddress(
  input: AddressObjectInput | undefined | null
): IAadhaarAddress | null {
  if (!input) {
    return null;
  }
  return {
    street: input.street.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    pincode: input.pincode.trim(),
    country: (input.country ?? 'India').trim(),
  };
}
