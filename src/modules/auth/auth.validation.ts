import { z } from 'zod';
import { ROLE_URL_SLUGS } from '../../config/roles';

export const roleParamSchema = z.object({
  role: z.enum(ROLE_URL_SLUGS as [string, ...string[]]),
});

export const requestOtpSchema = z.object({
  countryCode: z.string().min(1).default('+91'),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\d+$/, 'Phone must contain digits only'),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
});

export const verifyOtpSchema = z.object({
  countryCode: z.string().min(1).default('+91'),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\d+$/, 'Phone must contain digits only'),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
