import { SignedXml } from 'xml-crypto';
import { AppError } from '../../../common/errors';

/**
 * Attach AUA XML digital signature (XMLDSig) to the root element.
 * Signing key PEM must never be logged.
 */
export function signUidaiXml(input: {
  xml: string;
  signingKeyPem: string;
  signingCertPem: string;
}): string {
  try {
    const sig = new SignedXml({
      privateKey: input.signingKeyPem,
      publicCert: input.signingCertPem,
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      canonicalizationAlgorithm:
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    sig.addReference({
      xpath: '/*',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
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
