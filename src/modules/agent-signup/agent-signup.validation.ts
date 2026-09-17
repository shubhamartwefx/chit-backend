import { z } from 'zod';
import { addressObjectSchema } from '../../common/address';

export const requestAadhaarOtpSchema = z.object({
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
});

export const sessionIdBodySchema = z.object({
  sessionId: z.string().min(16).max(128),
});

export const verifyAadhaarOtpSchema = z.object({
  sessionId: z.string().min(16).max(128),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

export const digilockerCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(16).max(128),
});

export const completeRegistrationSchema = z.object({
  sessionId: z.string().min(16).max(128),
  countryCode: z.string().min(1).default('+91'),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\d+$/, 'Phone must contain digits only'),
  /** Optional; when set must include street, city, state, pincode, country. */
  currentAddress: addressObjectSchema.optional(),
  paymentId: z.string().min(4).max(128),
});

export type RequestAadhaarOtpInput = z.infer<typeof requestAadhaarOtpSchema>;
export type SessionIdBody = z.infer<typeof sessionIdBodySchema>;
export type VerifyAadhaarOtpInput = z.infer<typeof verifyAadhaarOtpSchema>;
export type DigilockerCallbackQuery = z.infer<
  typeof digilockerCallbackQuerySchema
>;
export type CompleteRegistrationInput = z.infer<
  typeof completeRegistrationSchema
>;
