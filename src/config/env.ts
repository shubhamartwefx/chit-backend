import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  PORT_FALLBACK_MAX_ATTEMPTS: z.coerce.number().default(10),
  API_VERSION: z.string().default('v1'),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  MOCK_OTP: z.string().length(6).default('123456'),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  SEED_SUPER_ADMIN_PHONE: z.string().default('9999999999'),
  SEED_SUPER_ADMIN_COUNTRY_CODE: z.string().default('+91'),
  SEED_SUPER_ADMIN_AADHAAR: z.string().default('123456789012'),
  SEED_SUPER_ADMIN_NAME: z.string().default('Saina Super Admin'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
