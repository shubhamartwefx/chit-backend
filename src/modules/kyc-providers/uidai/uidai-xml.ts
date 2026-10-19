import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: true,
});

export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function parseXml(xml: string): Record<string, unknown> {
  return parser.parse(xml) as Record<string, unknown>;
}

/** IST timestamp without timezone suffix (UIDAI OTP `ts`). */
export function formatUidaiTs(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

/** PID / Auth timestamp with milliseconds and IST offset. */
export function formatUidaiPidTs(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${ms}+05:30`;
}

/** AUA txn: alphanumeric + allowed punctuation, max 50. */
export function newUidaiTxn(prefix = 'CHIT'): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${stamp}-${rand}`.slice(0, 50);
}

export function getAttr(
  node: unknown,
  name: string
): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const record = node as Record<string, unknown>;
  const key = `@_${name}`;
  const value = record[key] ?? record[name];
  return value == null ? undefined : String(value);
}

export function findRoot(
  parsed: Record<string, unknown>,
  candidates: string[]
): unknown {
  for (const name of candidates) {
    if (parsed[name] != null) return parsed[name];
  }
  const keys = Object.keys(parsed);
  if (keys.length === 1) return parsed[keys[0]];
  return undefined;
}
