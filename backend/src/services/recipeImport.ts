/**
 * Recipe import (network).
 *
 * Fetches a recipe web page server-side and extracts a recipe from it. Uses the
 * built-in Node `http`/`https` modules (dependency-free). Extraction prefers
 * schema.org/Recipe JSON-LD (parseRecipeFromHtml); when unavailable it falls
 * back to running the plain-text recipe parser over the page text.
 *
 * Security: this makes an outbound request to a user-supplied URL, so it guards
 * against SSRF by rejecting non-http(s) URLs and hostnames that resolve to
 * loopback/private/link-local addresses. It also caps response size and time.
 */

import http from 'http';
import https from 'https';
import zlib from 'zlib';
import { lookup } from 'dns';
import net from 'net';
import { URL } from 'url';
import {
  parseRecipeFromHtml,
  htmlToText,
  ImportedRecipe,
} from './recipeImportParser';
import { parseRecipeText } from './recipeTextParser';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap

/**
 * A realistic desktop-Chrome header set. Presenting as a normal browser (rather
 * than an obvious bot User-Agent) lets more sites — including some behind
 * lightweight bot checks — return their full HTML. This does NOT defeat serious
 * bot protection (Cloudflare/Akamai/DataDome) or JavaScript-rendered pages;
 * those still fall back to the paste option.
 */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};
const REQUEST_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

/**
 * Suffix appended to failures where the page could not be read or parsed. Many
 * recipe sites block automated access or load their content with JavaScript
 * (so the recipe is not in the initial HTML). In those cases the reliable path
 * is to copy the recipe from the page and paste it into the box below.
 */
const PASTE_HINT =
  ' Some sites block automated imports or load their recipe with JavaScript. Copy the recipe from the page and paste it into the box below instead.';

/**
 * Error thrown when a URL is rejected before/for the fetch (bad URL, blocked
 * host, non-HTML response, etc.). Routes map this to a 400.
 */
export class RecipeImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeImportError';
  }
}

/**
 * Return true if the IP address is loopback, private, link-local, or otherwise
 * not a public destination. Blocks SSRF to internal services.
 */
export const isBlockedAddress = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    if (lower.startsWith('ff')) return true; // multicast
    if (lower.startsWith('64:ff9b:')) return true; // NAT64 (may map to internal v4)
    if (lower.startsWith('2001:db8')) return true; // documentation range
    // IPv4-mapped/-compatible IPv6 (::ffff:a.b.c.d or ::a.b.c.d) — check the v4 part.
    const embedded = lower.match(/::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (embedded && embedded[1]) return isBlockedAddress(embedded[1]);
    return false;
  }
  return true; // not a valid IP — treat as blocked
};

/**
 * A validated request target: the parsed URL plus the single IP address that
 * was validated. The fetch connects to exactly this IP (see fetchOnce), which
 * closes the DNS-rebinding gap where a second resolution at connect time could
 * return a different (internal) address than the one that was validated.
 */
interface ValidatedTarget {
  url: URL;
  ip: string;
  family: number; // 4 or 6
}

/**
 * Validate the URL string and resolve its host, rejecting blocked addresses.
 * Returns the parsed URL together with the exact validated IP to connect to.
 * @throws RecipeImportError when the URL is unsafe or malformed.
 */
const validateAndResolve = (rawUrl: string): Promise<ValidatedTarget> => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RecipeImportError('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new RecipeImportError('Only http and https URLs are supported');
  }

  const hostname = parsed.hostname;

  // If the hostname is already a literal IP, check it directly.
  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    if (isBlockedAddress(hostname)) {
      throw new RecipeImportError('URL host is not allowed');
    }
    return Promise.resolve({ url: parsed, ip: hostname, family: literalFamily });
  }

  // Block obvious localhost aliases before DNS.
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new RecipeImportError('URL host is not allowed');
  }

  return new Promise((resolve, reject) => {
    lookup(hostname, { all: true }, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        reject(new RecipeImportError('Could not resolve URL host'));
        return;
      }
      if (addresses.some((addr) => isBlockedAddress(addr.address))) {
        reject(new RecipeImportError('URL host is not allowed'));
        return;
      }
      // Pin the first validated address; the connect uses exactly this IP so a
      // rebinding record cannot swap in an internal address afterwards.
      const chosen = addresses[0]!;
      resolve({ url: parsed, ip: chosen.address, family: chosen.family });
    });
  });
};

/**
 * Perform a single GET request, returning the body text plus any redirect
 * Location. Enforces the size cap and timeout.
 */
const fetchOnce = (
  target: ValidatedTarget,
): Promise<{ status: number; body: string; location?: string; contentType: string }> => {
  const client = target.url.protocol === 'https:' ? https : http;

  // Pin DNS to the already-validated IP so the connect cannot resolve to a
  // different (internal) address than the one that passed validation.
  const pinnedLookup = (
    _hostname: string,
    _options: unknown,
    cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
  ): void => {
    cb(null, target.ip, target.family);
  };

  return new Promise((resolve, reject) => {
    const req = client.request(
      target.url,
      {
        method: 'GET',
        headers: BROWSER_HEADERS,
        timeout: REQUEST_TIMEOUT_MS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lookup: pinnedLookup as any,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        const contentType = String(res.headers['content-type'] ?? '');
        const contentEncoding = String(res.headers['content-encoding'] ?? '').toLowerCase();

        // For redirects we don't need the body.
        if (status >= 300 && status < 400 && location) {
          res.resume(); // drain
          resolve({ status, body: '', location, contentType });
          return;
        }

        let received = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_BYTES) {
            req.destroy();
            reject(new RecipeImportError('Recipe page is too large to import.' + PASTE_HINT));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const raw = Buffer.concat(chunks);

          // Decompress if the server used content-encoding (we advertised
          // gzip/deflate/br). Fall back to the raw bytes if decompression fails
          // or the encoding is unknown/identity.
          // Cap the decompressed output too, to guard against decompression
          // bombs (a small compressed payload expanding to something huge).
          const DECOMPRESS_MAX = MAX_BYTES * 8;
          let bodyBuf = raw;
          try {
            if (contentEncoding === 'gzip') {
              bodyBuf = zlib.gunzipSync(raw, { maxOutputLength: DECOMPRESS_MAX });
            } else if (contentEncoding === 'deflate') {
              bodyBuf = zlib.inflateSync(raw, { maxOutputLength: DECOMPRESS_MAX });
            } else if (contentEncoding === 'br') {
              bodyBuf = zlib.brotliDecompressSync(raw, {
                params: { [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length },
                maxOutputLength: DECOMPRESS_MAX,
              });
            }
          } catch {
            bodyBuf = raw;
          }

          resolve({
            status,
            body: bodyBuf.toString('utf8'),
            contentType,
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new RecipeImportError('Timed out fetching the recipe page.' + PASTE_HINT));
    });
    req.on('error', () => {
      reject(new RecipeImportError('Could not reach the recipe page.' + PASTE_HINT));
    });
    req.end();
  });
};

/**
 * Fetch a URL following redirects (each redirect target is re-validated to
 * prevent redirect-based SSRF), returning the final HTML body.
 */
const fetchHtml = async (rawUrl: string): Promise<string> => {
  let current = await validateAndResolve(rawUrl);

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const result = await fetchOnce(current);

    if (result.status >= 300 && result.status < 400 && result.location) {
      const next = new URL(result.location, current.url);
      // Re-validate the redirect target (defends against redirect to internal host).
      current = await validateAndResolve(next.toString());
      continue;
    }

    if (result.status >= 400) {
      throw new RecipeImportError(
        `The site refused the request (HTTP ${result.status}).` + PASTE_HINT,
      );
    }

    if (result.contentType && !result.contentType.includes('html')) {
      throw new RecipeImportError('The URL did not return a readable web page.' + PASTE_HINT);
    }

    return result.body;
  }

  throw new RecipeImportError('The recipe page redirected too many times.' + PASTE_HINT);
};

/**
 * Import a recipe from a URL. Returns a normalized preview (not persisted).
 * Prefers JSON-LD; falls back to the plain-text parser over the page text.
 *
 * @throws RecipeImportError for unsafe/unreachable URLs or unparseable pages.
 */
export const importRecipeFromUrl = async (
  rawUrl: string,
): Promise<ImportedRecipe & { sourceUrl: string }> => {
  if (!rawUrl || rawUrl.trim().length === 0) {
    throw new RecipeImportError('A URL is required');
  }

  const html = await fetchHtml(rawUrl.trim());

  const structured = parseRecipeFromHtml(html);
  if (structured) {
    return { ...structured, sourceUrl: rawUrl.trim() };
  }

  // Fallback: run the text parser over readable page text.
  const text = htmlToText(html);
  const parsed = parseRecipeText(text);
  if (parsed.name || parsed.ingredients.length > 0 || parsed.steps.length > 0) {
    return {
      name: parsed.name,
      summary: parsed.summary,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      sourceUrl: rawUrl.trim(),
    };
  }

  throw new RecipeImportError('Could not find a recipe on that page.' + PASTE_HINT);
};
