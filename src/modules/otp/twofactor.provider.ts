import { AppError } from '../../common/errors';
import { env } from '../../config/env';

export interface SmsOtpProvider {
  generateOtp(): string;
  deliver(phone: string, countryCode: string, otp: string): Promise<void>;
}

type TwoFactorResponse = {
  Status?: string;
  Details?: string;
};

function toE164(phone: string, countryCode: string): string {
  const digits = phone.replace(/\D/g, '');
  const cc = countryCode.replace(/\D/g, '') || '91';
  if (digits.startsWith(cc) && digits.length > 10) {
    return `+${digits}`;
  }
  return `+${cc}${digits}`;
}

function generateNumericOtp(length = 6): string {
  const max = 10 ** length;
  const value = Math.floor(Math.random() * max);
  return value.toString().padStart(length, '0');
}

/**
 * 2Factor.in SMS OTP (manual OTP mode).
 * Send: GET https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}[/{template}]
 * Verification stays local via hashed OTP in OtpSession.
 */
export class TwoFactorOtpProvider implements SmsOtpProvider {
  generateOtp(): string {
    return generateNumericOtp(6);
  }

  async deliver(phone: string, countryCode: string, otp: string): Promise<void> {
    const apiKey = env.TWOFACTOR_API_KEY?.trim();
    if (!apiKey) {
      throw new AppError(
        'SMS provider is not configured (TWOFACTOR_API_KEY missing)',
        500,
        'SMS_NOT_CONFIGURED'
      );
    }

    const fullPhone = toE164(phone, countryCode);
    const base = env.TWOFACTOR_BASE_URL.replace(/\/$/, '');
    const template = env.TWOFACTOR_TEMPLATE_NAME?.trim();
    const path = template
      ? `${base}/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(fullPhone)}/${encodeURIComponent(otp)}/${encodeURIComponent(template)}`
      : `${base}/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(fullPhone)}/${encodeURIComponent(otp)}`;

    let response: Response;
    try {
      response = await fetch(path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SMS gateway unreachable';
      throw new AppError(
        `Failed to send OTP SMS: ${message}`,
        502,
        'SMS_DELIVERY_FAILED'
      );
    }

    let body: TwoFactorResponse = {};
    try {
      body = (await response.json()) as TwoFactorResponse;
    } catch {
      throw new AppError(
        'SMS gateway returned an invalid response',
        502,
        'SMS_DELIVERY_FAILED'
      );
    }

    if (!response.ok || body.Status !== 'Success') {
      throw new AppError(
        body.Details || 'Failed to send OTP SMS',
        502,
        'SMS_DELIVERY_FAILED',
        body
      );
    }

    if (env.NODE_ENV !== 'production') {
      console.log(
        `[2FACTOR OTP] sent to ${fullPhone} (session=${body.Details ?? 'n/a'})`
      );
    }
  }
}
