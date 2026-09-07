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
  totp: z
    .string()
    .regex(/^\d{6}$/, 'Authenticator code must be exactly 6 digits'),
});

export type Verify2faInput = z.infer<typeof verify2faSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

const pinSchema = z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits');
const totpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Authenticator code must be exactly 6 digits');

export const securityConfigureSchema = z.object({
  method: z.enum(['totp', 'screen_lock', 'biometric']),
  enabled: z.boolean(),
  pin: pinSchema.optional(),
  currentPin: pinSchema.optional(),
  totp: totpCodeSchema.optional(),
  webauthnResponse: z.record(z.string(), z.unknown()).optional(),
});

export type SecurityConfigureInput = z.infer<typeof securityConfigureSchema>;

export const securityUnlockSchema = z
  .object({
    method: z.enum(['pin', 'totp', 'biometric']),
    pin: pinSchema.optional(),
    totp: totpCodeSchema.optional(),
    webauthnResponse: z.record(z.string(), z.unknown()).optional(),
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

export type SecurityUnlockInput = z.infer<typeof securityUnlockSchema>;
