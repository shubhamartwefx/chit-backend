import { AppError } from '../../../common/errors';
import type { IVerifiedAadhaarProfile } from '../types';
import { findRoot, getAttr, parseXml } from './uidai-xml';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v != null && typeof v !== 'object' && String(v).trim()) {
      return String(v).trim();
    }
  }
  return '';
}

function genderLabel(raw: string): string {
  const g = raw.trim().toUpperCase();
  if (g === 'M' || g === 'MALE') return 'Male';
  if (g === 'F' || g === 'FEMALE') return 'Female';
  if (g === 'T' || g === 'O' || g === 'TRANSGENDER') return 'Other';
  return raw || 'Other';
}

function formatDob(raw: string): string {
  // UIDAI often uses YYYY-MM-DD; app stores DD/MM/YYYY in mock profiles.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return raw;
}

function findUidData(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const roots = [
    findRoot(parsed, ['KycRes', 'Resp', 'AuthRes']),
    parsed,
  ];
  for (const root of roots) {
    const r = asRecord(root);
    if (!r) continue;
    const uidData =
      asRecord(r.UidData) ||
      asRecord(r.uidData) ||
      asRecord(asRecord(r.KycRes)?.UidData);
    if (uidData) return uidData;

    // Nested CertificateData / Poi / Poa sometimes at top level after decrypt
    if (r.Poi || r.Poa || r.poi || r.poa) return r;
  }
  return null;
}

/**
 * Map UIDAI eKYC XML (plain or already decrypted) to sealed profile shape.
 */
export function mapEkycXmlToProfile(
  kycXml: string,
  aadhaarLast4: string
): IVerifiedAadhaarProfile {
  let parsed: Record<string, unknown>;
  try {
    parsed = parseXml(kycXml);
  } catch {
    throw new AppError(
      'Aadhaar verification failed. Try again later.',
      502,
      'AADHAAR_UPSTREAM_ERROR'
    );
  }

  const uidData = findUidData(parsed);
  if (!uidData) {
    throw new AppError(
      'Aadhaar verification failed. Try again later.',
      502,
      'AADHAAR_UPSTREAM_ERROR',
      { reason: 'missing_uid_data' }
    );
  }

  const poi =
    asRecord(uidData.Poi) ||
    asRecord(uidData.poi) ||
    asRecord(uidData.POI) ||
    {};
  const poa =
    asRecord(uidData.Poa) ||
    asRecord(uidData.poa) ||
    asRecord(uidData.POA) ||
    {};

  const fullName = pickString(
    getAttr(poi, 'name'),
    poi.name,
    getAttr(uidData, 'name')
  );
  const gender = genderLabel(
    pickString(getAttr(poi, 'gender'), poi.gender, 'O')
  );
  const dateOfBirth = formatDob(
    pickString(getAttr(poi, 'dob'), poi.dob, getAttr(poi, 'dobt'))
  );

  const house = pickString(getAttr(poa, 'house'), poa.house);
  const street = pickString(getAttr(poa, 'street'), poa.street);
  const loc = pickString(getAttr(poa, 'loc'), poa.loc);
  const landmark = pickString(getAttr(poa, 'lm'), poa.lm);
  const vtc = pickString(getAttr(poa, 'vtc'), poa.vtc);
  const subdist = pickString(getAttr(poa, 'subdist'), poa.subdist);
  const dist = pickString(getAttr(poa, 'dist'), poa.dist);
  const state = pickString(getAttr(poa, 'state'), poa.state);
  const pc = pickString(getAttr(poa, 'pc'), poa.pc, getAttr(poa, 'pincode'));
  const country = pickString(getAttr(poa, 'country'), poa.country, 'India');

  const streetLine = [house, street, loc, landmark, vtc, subdist]
    .filter(Boolean)
    .join(', ');

  if (!fullName || !dateOfBirth) {
    throw new AppError(
      'Aadhaar verification failed. Try again later.',
      502,
      'AADHAAR_UPSTREAM_ERROR',
      { reason: 'incomplete_kyc' }
    );
  }

  return {
    fullName,
    gender,
    dateOfBirth,
    aadhaarAddress: {
      street: streetLine || dist || '—',
      city: dist || vtc || '—',
      state: state || '—',
      pincode: pc || '000000',
      country: country || 'India',
    },
    aadhaarLast4,
  };
}
