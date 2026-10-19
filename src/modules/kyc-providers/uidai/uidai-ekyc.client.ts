import { AppError } from '../../../common/errors';
import type { UidaiRuntimeConfig } from './uidai-config';
import { encryptPidBlock } from './uidai-crypto';
import { mapUidaiErr } from './uidai-error-map';
import { mapEkycXmlToProfile } from './uidai-kyc-map';
import { signUidaiXml } from './uidai-sign';
import type { IVerifiedAadhaarProfile } from '../types';
import {
  escapeXmlAttr,
  findRoot,
  formatUidaiPidTs,
  getAttr,
  parseXml,
} from './uidai-xml';

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
    console.error('[UIDAI] eKYC HTTP error', { status: res.status });
    throw new AppError(
      'Aadhaar verification failed. Try again later.',
      502,
      'AADHAAR_UPSTREAM_ERROR',
      { httpStatus: res.status, phase: 'ekyc' }
    );
  }
  return text;
}

function buildPidXml(otp: string, ts: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Pid ts="${escapeXmlAttr(ts)}" ver="2.0">` +
    `<Pv otp="${escapeXmlAttr(otp)}"/>` +
    `</Pid>`
  );
}

function buildEkycXml(input: {
  uid: string;
  txn: string;
  config: UidaiRuntimeConfig;
  encryptedSessionKeyB64: string;
  encryptedPidB64: string;
  encryptedHmacB64: string;
  ci: string;
}): string {
  const { config } = input;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Auth uid="${escapeXmlAttr(input.uid)}" ` +
    `rc="Y" tid="public" ` +
    `ac="${escapeXmlAttr(config.auaCode)}" ` +
    `sa="${escapeXmlAttr(config.subAuaCode)}" ` +
    `ver="2.5" ` +
    `txn="${escapeXmlAttr(input.txn)}" ` +
    `lk="${escapeXmlAttr(config.licenseKey)}">` +
    `<Uses pi="n" pa="n" pfa="n" bio="n" bt="" pin="n" otp="y"/>` +
    `<Meta udc="CHIT01" fdc="NC" pip="NA" lot="P" lov="560001"/>` +
    `<Skey ci="${escapeXmlAttr(input.ci)}">${input.encryptedSessionKeyB64}</Skey>` +
    `<Data type="X">${input.encryptedPidB64}</Data>` +
    `<Hmac>${input.encryptedHmacB64}</Hmac>` +
    `</Auth>`
  );
}

function extractKycXml(responseXml: string): string {
  // Prefer nested UidData / Rar / CertificateData content when present.
  const parsed = parseXml(responseXml);
  const root = findRoot(parsed, ['KycRes', 'Resp', 'AuthRes']);
  const ret = (getAttr(root, 'ret') ?? getAttr(parsed.KycRes, 'ret') ?? '').toLowerCase();
  const err = getAttr(root, 'err') ?? getAttr(parsed.KycRes, 'err');

  if (ret && ret !== 'y' && ret !== 'yes') {
    throw mapUidaiErr(err, 'ekyc');
  }

  // Some responses embed KYC as base64 under `#text` of Rar / UidData
  const rootRec = root as Record<string, unknown> | undefined;
  const rar = rootRec?.Rar ?? rootRec?.rar;
  if (typeof rar === 'string' && rar.trim()) {
    try {
      return Buffer.from(rar, 'base64').toString('utf8');
    } catch {
      return rar;
    }
  }

  // If UidData already present in response XML, use full response
  if (responseXml.includes('UidData') || responseXml.includes('<Poi')) {
    return responseXml;
  }

  throw new AppError(
    'Aadhaar verification failed. Try again later.',
    502,
    'AADHAAR_UPSTREAM_ERROR',
    { phase: 'ekyc', reason: 'missing_kyc_payload' }
  );
}

export async function verifyUidaiOtpViaEkyc(input: {
  aadhaarNumber: string;
  txn: string;
  otp: string;
  config: UidaiRuntimeConfig;
}): Promise<IVerifiedAadhaarProfile> {
  const pidTs = formatUidaiPidTs();
  const pidXml = buildPidXml(input.otp, pidTs);
  const encrypted = encryptPidBlock({
    pidXml,
    uidaiPublicCertPem: input.config.publicCertPem,
    ci: input.config.ci,
  });

  const unsigned = buildEkycXml({
    uid: input.aadhaarNumber,
    txn: input.txn,
    config: input.config,
    encryptedSessionKeyB64: encrypted.encryptedSessionKeyB64,
    encryptedPidB64: encrypted.encryptedPidB64,
    encryptedHmacB64: encrypted.encryptedHmacB64,
    ci: encrypted.ci,
  });

  const signed = signUidaiXml({
    xml: unsigned,
    signingKeyPem: input.config.signingKeyPem,
    signingCertPem: input.config.signingCertPem,
  });

  // eKYC endpoint often expects a Kyc wrapper; try Auth-shaped body first at eKYC URL.
  // If ASA requires <Kyc>, wrap Auth for transport.
  const kycEnvelope =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Kyc ver="2.5" ts="${escapeXmlAttr(pidTs)}" ra="F" rc="Y" lr="N" de="N" pfr="N">` +
    // Strip XML declaration from signed Auth before embedding
    signed.replace(/^<\?xml[^>]*\?>/, '') +
    `</Kyc>`;

  const responseXml = await postXml(input.config.ekycBaseUrl, kycEnvelope);
  let kycXml: string;
  try {
    kycXml = extractKycXml(responseXml);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapUidaiErr(undefined, 'ekyc', input.txn);
  }

  return mapEkycXmlToProfile(kycXml, input.aadhaarNumber.slice(-4));
}
