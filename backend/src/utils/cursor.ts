/**
 * Opaque cursor helpers for keyset (cursor-based) pagination.
 *
 * A cursor is an opaque base64 string that encodes the ordering-key tuple of
 * the last row of the previous page (e.g. `{ ts, id }`). Routes treat the
 * value as opaque: they pass whatever the previous response returned as
 * `nextCursor` back in as `?cursor=`.
 *
 * `decodeCursor` THROWS on malformed input so route handlers can catch and
 * return HTTP 400 rather than silently re-serving the first page (which would
 * duplicate rows across pages).
 */

/**
 * Encode an arbitrary JSON-serializable object into an opaque base64 cursor.
 *
 * @param obj Any JSON-serializable value (typically an ordering-key tuple).
 * @returns An opaque base64 string.
 */
export const encodeCursor = (obj: unknown): string => {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8').toString('base64');
};

/**
 * Decode an opaque base64 cursor back into its object form.
 *
 * @param str The opaque cursor string produced by `encodeCursor`.
 * @returns The parsed object.
 * @throws Error if the input is not a non-empty string, not valid base64, or
 *   does not decode to valid JSON representing an object.
 */
export const decodeCursor = <T = Record<string, unknown>>(str: string): T => {
  if (typeof str !== 'string' || str.length === 0) {
    throw new Error('Malformed cursor: expected a non-empty string');
  }

  let json: string;
  try {
    json = Buffer.from(str, 'base64').toString('utf8');
  } catch {
    throw new Error('Malformed cursor: not valid base64');
  }

  if (json.length === 0) {
    throw new Error('Malformed cursor: empty payload');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Malformed cursor: not valid JSON');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Malformed cursor: expected an object payload');
  }

  return parsed as T;
};

/**
 * Default page size applied when no `limit` is specified by the request.
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Maximum page size a request may ask for.
 */
export const MAX_PAGE_SIZE = 200;

/**
 * Clamp a requested limit to `[1, MAX_PAGE_SIZE]`, falling back to
 * `DEFAULT_PAGE_SIZE` when the value is missing or not a positive integer.
 *
 * @param raw The raw `limit` query value (string | undefined | unknown).
 * @returns A safe integer page size.
 */
export const clampLimit = (raw: unknown): number => {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_PAGE_SIZE;
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(num, MAX_PAGE_SIZE);
};
