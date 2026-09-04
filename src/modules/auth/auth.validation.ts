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

export const verify2faSchema = z.object({
  countryCode: z.string().min(1).default('+91'),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\d+$/, 'Phone must contain digits only'),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
  totp: z.string().regex(/^\d{6}$/, 'Authenticator code must be exactly 6 digits'),
});

export type Verify2faInput = z.infer<typeof verify2faSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const totpConfirmSchema = z.object({
  totp: z.string().regex(/^\d{6}$/, 'Authenticator code must be exactly 6 digits'),
});

export const setPinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits'),
  currentPin: z
    .string()
    .regex(/^\d{4,8}$/)
    .optional(),
  totp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const screenLockEnableSchema = z.object({
  enabled: z.boolean(),
});

export const screenLockUnlockSchema = z
  .object({
    method: z.enum(['pin', 'totp']),
    pin: z
      .string()
      .regex(/^\d{4,8}$/)
      .optional(),
    totp: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.method === 'pin' && !val.pin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PIN is required',
        path: ['pin'],
      });
    }
    if (val.method === 'totp' && !val.totp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Authenticator code is required',
        path: ['totp'],
      });
    }
  });
