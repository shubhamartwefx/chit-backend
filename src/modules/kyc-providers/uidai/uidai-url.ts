/**
 * UIDAI AUA gateways expect versioned base + AUA + first two UID digits, e.g.:
 *   {UIDAI_*_BASE_URL}/{ac}/{uid[0]}/{uid[1]}[/{asalk}]
 * Posting to the bare `/2.5` base commonly returns HTTP 404.
 *
 * ASA license (asalk) is only appended for ASA gateways — not for
 * developer.uidai.gov.in public sandbox URLs.
 */
export function buildUidaiRequestUrl(
  baseUrl: string,
  auaCode: string,
  aadhaarNumber: string,
  asaLicenseKey?: string
): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const uid = aadhaarNumber.replace(/\D/g, '');
  if (uid.length < 2) {
    throw new Error('Aadhaar number too short for UIDAI URL path');
  }
  const ac = encodeURIComponent(auaCode.trim() || 'public');
  let url = `${base}/${ac}/${uid[0]}/${uid[1]}`;
  const asalk = asaLicenseKey?.trim();
  if (asalk && shouldAppendAsaLicense(base)) {
    url += `/${encodeURIComponent(asalk)}`;
  }
  return url;
}

function shouldAppendAsaLicense(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    // Some public developer hosts omit asalk; OTP staging / ASA hosts require it.
    if (host === 'developer.uidai.gov.in' || host === 'auth.uidai.gov.in') {
      return false;
    }
  } catch {
    // Relative or invalid — still allow asalk if provided.
  }
  return true;
}

