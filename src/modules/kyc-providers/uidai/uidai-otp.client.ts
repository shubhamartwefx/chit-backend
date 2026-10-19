import { AppError } from '../../../common/errors';
import type { UidaiRuntimeConfig } from './uidai-config';
import { mapUidaiErr } from './uidai-error-map';
import { signUidaiXml } from './uidai-sign';
import {
  escapeXmlAttr,
  findRoot,
  formatUidaiTs,
  getAttr,
  newUidaiTxn,
  parseXml,
} from './uidai-xml';

export type UidaiOtpResult = {
  txn: string;
  otpResponseCode?: string;
};

async function postXml(url: string, xml: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      Accept: 'application/xml, text/xml, */*',
    },
    body: xml,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('[UIDAI] OTP HTTP error', {
      status: res.status,
      // Never log response body (may contain sensitive data)
    });
    throw new AppError(
      'Aadhaar verification failed. Try again later.',
      502,
      'AADHAAR_UPSTREAM_ERROR',
      { httpStatus: res.status, phase: 'otp' }
    );
  }
  return text;
}

function buildOtpXml(input: {
  uid: string;
  txn: string;
  ts: string;
  config: UidaiRuntimeConfig;
}): string {
  const { config } = input;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Otp uid="${escapeXmlAttr(input.uid)}" ` +
    `ac="${escapeXmlAttr(config.auaCode)}" ` +
    `sa="${escapeXmlAttr(config.subAuaCode)}" ` +
    `ver="2.5" ` +
    `txn="${escapeXmlAttr(input.txn)}" ` +
    `ts="${escapeXmlAttr(input.ts)}" ` +
    `lk="${escapeXmlAttr(config.licenseKey)}" ` +
    `type="A">` +
    `<Opts ch="00"/>` +
    `</Otp>`
  );
}

export async function requestUidaiOtp(input: {
  aadhaarNumber: string;
  config: UidaiRuntimeConfig;
  txn?: string;
}): Promise<UidaiOtpResult> {
  const txn = input.txn ?? newUidaiTxn('OTP');
  const ts = formatUidaiTs();
  const unsigned = buildOtpXml({
    uid: input.aadhaarNumber,
    txn,
    ts,
    config: input.config,
  });
  const signed = signUidaiXml({
    xml: unsigned,
    signingKeyPem: input.config.signingKeyPem,
    signingCertPem: input.config.signingCertPem,
  });

  const responseXml = await postXml(input.config.otpBaseUrl, signed);
  let parsed: Record<string, unknown>;
  try {
    parsed = parseXml(responseXml);
  } catch {
    throw new AppError(
      'Aadhaar verification failed. Try again later.',
      502,
      'AADHAAR_UPSTREAM_ERROR',
      { phase: 'otp', reason: 'bad_xml' }
    );
  }

  const root = findRoot(parsed, ['OtpRes', 'otpRes']);
  const ret = (getAttr(root, 'ret') ?? '').toLowerCase();
  const err = getAttr(root, 'err');
  const code = getAttr(root, 'code');
  const resTxn = getAttr(root, 'txn') ?? txn;

  if (ret !== 'y' && ret !== 'yes') {
    throw mapUidaiErr(err, 'otp', resTxn);
  }

  return { txn: resTxn, otpResponseCode: code };
}
