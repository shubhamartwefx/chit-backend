import { SignedXml } from 'xml-crypto';
import { AppError } from '../../../common/errors';

/** Keep only the first PEM block (openssl pkcs12 leaves Bag Attributes above it). */
export function extractPemBlock(raw: string): string {
  const match = raw.match(
    /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/
  );
  return match ? `${match[0]}\n` : raw.trim();
}

/**
 * Attach AUA XML digital signature (XMLDSig) to the root element.
 * Matches UIDAI sample client: URI="", enveloped-only reference transform,
 * RSA-SHA1 + inclusive C14N on SignedInfo, X509 KeyInfo.
 * Signing key PEM must never be logged.
 */
export function signUidaiXml(input: {
  xml: string;
  signingKeyPem: string;
  signingCertPem: string;
}): string {
  try {
    const privateKey = extractPemBlock(input.signingKeyPem);
    const publicCert = extractPemBlock(input.signingCertPem);

    const sig = new SignedXml({
      privateKey,
      publicCert,
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      canonicalizationAlgorithm:
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    // UIDAI sample (OtpAPIService): Reference URI="" + Transform ENVELOPED only.
    // Do NOT add an Id on the root or use URI="#_0" — that yields err 569.
    sig.addReference({
      xpath: '/*',
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      uri: '',
      isEmptyUri: true,
    });

    sig.computeSignature(input.xml, {
      location: { reference: '/*', action: 'append' },
      prefix: '',
    });

    return sig.getSignedXml();
  } catch (err) {
    console.error('[UIDAI] XML signature failed', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    throw new AppError(
      'Aadhaar request signature failed',
      502,
      'AADHAAR_SIGNATURE_FAILED'
    );
  }
}
