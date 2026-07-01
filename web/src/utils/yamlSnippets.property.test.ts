/**
 * YAML Snippet Generator Property-Based Tests
 *
 * Feature: ha-dashboard-integration, Property 11: YAML snippet interpolation correctness
 *
 * For any user ID, user name, and ingress path, all generated snippets contain
 * the userId where user-specific data is referenced and contain the correct
 * ingressPath in URL references.
 *
 * **Validates: Requirements 7.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateYamlSnippets } from './yamlSnippets';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a UUID-format userId */
const userIdArb = fc.uuid();

/** Generates a non-empty userName */
const userNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/** Generates an ingressPath starting with / */
const ingressPathArb = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => s.trim().length > 0)
  .map((s) => '/' + s.replace(/^\/+/, '') + '/');

/** Generates a backendUrl starting with http:// */
const backendUrlArb = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => s.trim().length > 0 && !s.includes(' '))
  .map((s) => 'http://' + s.replace(/^https?:\/\//, ''));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('YAML Snippet Generator - Property 11: YAML snippet interpolation correctness', () => {
  // Feature: ha-dashboard-integration, Property 11: YAML snippet interpolation correctness

  /**
   * Property 11a: Snippets that reference a user (rest_sensor_user,
   * rest_command_complete_task, rest_command_purchase_item) contain the userId.
   *
   * **Validates: Requirements 7.3**
   */
  it('user-specific snippets contain the userId', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userNameArb,
        ingressPathArb,
        backendUrlArb,
        (userId, userName, ingressPath, backendUrl) => {
          const snippets = generateYamlSnippets({
            userId,
            userName,
            ingressPath,
            backendUrl,
          });

          // These snippets reference user-specific data and must contain the userId
          const userSpecificSnippets = [
            'rest_sensor_user',
            'rest_command_complete_task',
            'rest_command_purchase_item',
          ];

          for (const key of userSpecificSnippets) {
            const snippet = snippets[key];
            expect(snippet).toBeDefined();
            expect(snippet).toContain(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11b: Snippets that reference URLs (rest_sensor_tasks,
   * rest_sensor_shopping, rest_sensor_user, rest_command_complete_task,
   * rest_command_purchase_item) contain the backendUrl.
   *
   * **Validates: Requirements 7.3**
   */
  it('URL-referencing snippets contain the backendUrl', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userNameArb,
        ingressPathArb,
        backendUrlArb,
        (userId, userName, ingressPath, backendUrl) => {
          const snippets = generateYamlSnippets({
            userId,
            userName,
            ingressPath,
            backendUrl,
          });

          // These snippets reference backend API URLs
          const urlSnippets = [
            'rest_sensor_tasks',
            'rest_sensor_shopping',
            'rest_sensor_user',
            'rest_command_complete_task',
            'rest_command_purchase_item',
          ];

          for (const key of urlSnippets) {
            const snippet = snippets[key];
            expect(snippet).toBeDefined();
            expect(snippet).toContain(backendUrl);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11c: Snippets that reference navigation paths (button_card_deep_link,
   * button_card_open_app) contain the ingressPath.
   *
   * **Validates: Requirements 7.3**
   */
  it('navigation snippets contain the ingressPath', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userNameArb,
        ingressPathArb,
        backendUrlArb,
        (userId, userName, ingressPath, backendUrl) => {
          const snippets = generateYamlSnippets({
            userId,
            userName,
            ingressPath,
            backendUrl,
          });

          // These snippets reference the ingress navigation path
          const navigationSnippets = [
            'button_card_deep_link',
            'button_card_open_app',
          ];

          for (const key of navigationSnippets) {
            const snippet = snippets[key];
            expect(snippet).toBeDefined();
            expect(snippet).toContain(ingressPath);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11d: The rest_sensor_user snippet also contains the userName
   * for display purposes.
   *
   * **Validates: Requirements 7.3**
   */
  it('rest_sensor_user snippet contains the userName', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userNameArb,
        ingressPathArb,
        backendUrlArb,
        (userId, userName, ingressPath, backendUrl) => {
          const snippets = generateYamlSnippets({
            userId,
            userName,
            ingressPath,
            backendUrl,
          });

          const userSensorSnippet = snippets['rest_sensor_user'];
          expect(userSensorSnippet).toBeDefined();
          expect(userSensorSnippet).toContain(userName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
