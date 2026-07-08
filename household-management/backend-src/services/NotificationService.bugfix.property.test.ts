/**
 * Bug Condition Exploration Test - Property 1: Wrong HA Service Endpoint and Payload
 *
 * **Validates: Requirements 1.1, 2.1, 2.2**
 *
 * This test encodes the EXPECTED correct behavior for callHaApi():
 * - POST /api/services/persistent_notification/create with { message, title, notification_id }
 * - POST /api/services/notify/mobile_app_{haUsername} with { message, title }
 *
 * On UNFIXED code, this test FAILS because callHaApi() currently:
 * - Calls POST /api/services/notify/notify (wrong endpoint)
 * - Sends { message, target: haUsername } (wrong payload)
 * - Makes only 1 call instead of 2
 *
 * After the fix is applied, this test should PASS.
 */

import * as fc from 'fast-check';
import { NotificationService } from './NotificationService';

// Arbitrary: valid HA username (lowercase letters, underscores, digits, 1-20 chars, starts with letter)
const haUsernameArb: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      fc.constant('_'),
      fc.constantFrom(...'0123456789'.split('')),
    ),
    { minLength: 1, maxLength: 19 },
  )
  .map((chars) => chars.join(''))
  .map((rest) => {
    // Ensure first char is a letter
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const firstChar = letters[rest.charCodeAt(0) % letters.length];
    return firstChar + rest;
  });

// Arbitrary: non-empty message string (alphanumeric + spaces, 1-100 chars)
const messageArb: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
    ),
    { minLength: 1, maxLength: 100 },
  )
  .map((chars) => chars.join(''))
  .filter((s) => s.trim().length > 0);

describe('Bug Condition Exploration: Wrong HA Service Endpoint and Payload', () => {
  let service: NotificationService;
  let fetchCalls: Array<{ url: string; options: RequestInit }>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    service = new NotificationService();
    fetchCalls = [];
    originalFetch = global.fetch;

    // Mock fetch globally to capture calls
    global.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, options: init || {} });
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * Property: For any valid haUsername and non-empty message, callHaApi MUST make
   * two fetch calls:
   *   1. URL contains "persistent_notification/create"
   *   2. URL contains "notify/mobile_app_{haUsername}"
   */
  it('callHaApi calls persistent_notification/create AND notify/mobile_app_{haUsername}', async () => {
    await fc.assert(
      fc.asyncProperty(haUsernameArb, messageArb, async (haUsername: string, message: string) => {
        // Reset captured calls for each run
        fetchCalls = [];

        await service.callHaApi(haUsername, message);

        // Assert: exactly 2 fetch calls were made
        expect(fetchCalls.length).toBe(2);

        // Assert: one call to persistent_notification/create
        const persistentCall = fetchCalls.find((c) =>
          c.url.includes('persistent_notification/create'),
        );
        expect(persistentCall).toBeDefined();

        // Assert: one call to notify/mobile_app_{haUsername}
        const mobileCall = fetchCalls.find((c) =>
          c.url.includes(`notify/mobile_app_${haUsername}`),
        );
        expect(mobileCall).toBeDefined();

        // Assert: persistent notification payload has { message, title, notification_id }
        if (persistentCall) {
          const body = JSON.parse(persistentCall.options.body as string);
          expect(body).toHaveProperty('message');
          expect(body).toHaveProperty('title');
          expect(body).toHaveProperty('notification_id');
          expect(body.message).toBe(message);
        }

        // Assert: mobile push payload has { message, title } (no target field)
        if (mobileCall) {
          const body = JSON.parse(mobileCall.options.body as string);
          expect(body).toHaveProperty('message');
          expect(body).toHaveProperty('title');
          expect(body).not.toHaveProperty('target');
          expect(body.message).toBe(message);
        }
      }),
      { numRuns: 100 },
    );
  });
});
