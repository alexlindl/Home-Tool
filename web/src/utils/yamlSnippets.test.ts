import { describe, it, expect } from 'vitest';
import { generateYamlSnippets } from './yamlSnippets';

describe('generateYamlSnippets', () => {
  const params = {
    userId: 'user-123',
    userName: 'TestUser',
    ingressPath: '/api/hassio_ingress/abc/',
    backendUrl: 'http://localhost:8099',
  };

  const snippets = generateYamlSnippets(params);

  it('returns all expected snippet keys', () => {
    const expectedKeys = [
      'rest_sensor_tasks',
      'rest_sensor_shopping',
      'rest_sensor_user',
      'markdown_card_tasks',
      'markdown_card_shopping',
      'button_card_deep_link',
      'rest_command_complete_task',
      'rest_command_purchase_item',
      'button_card_open_app',
    ];

    for (const key of expectedKeys) {
      expect(snippets[key]).toBeDefined();
    }
  });

  it('all snippets are non-empty strings', () => {
    for (const [_key, value] of Object.entries(snippets)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('task sensor snippet contains correct backendUrl + /api/summary/tasks', () => {
    expect(snippets['rest_sensor_tasks']).toContain(
      'http://localhost:8099/api/summary/tasks'
    );
  });

  it('shopping sensor snippet contains correct backendUrl + /api/summary/shopping', () => {
    expect(snippets['rest_sensor_shopping']).toContain(
      'http://localhost:8099/api/summary/shopping'
    );
  });

  it('user sensor snippet contains the userId in the URL', () => {
    expect(snippets['rest_sensor_user']).toContain(
      'http://localhost:8099/api/summary/user/user-123'
    );
  });

  it('user sensor snippet contains the userName', () => {
    expect(snippets['rest_sensor_user']).toContain('TestUser');
  });

  it('rest_command_complete_task snippet contains the userId in the payload', () => {
    expect(snippets['rest_command_complete_task']).toContain('"userId": "user-123"');
  });

  it('rest_command_purchase_item snippet contains the userId in the payload', () => {
    expect(snippets['rest_command_purchase_item']).toContain('"userId": "user-123"');
  });

  it('button_card_open_app snippet contains the ingressPath', () => {
    expect(snippets['button_card_open_app']).toContain('/api/hassio_ingress/abc/');
  });

  it('button_card_deep_link snippet contains the ingressPath', () => {
    expect(snippets['button_card_deep_link']).toContain('/api/hassio_ingress/abc/');
  });

  it('rest_command snippets contain the backendUrl', () => {
    expect(snippets['rest_command_complete_task']).toContain('http://localhost:8099');
    expect(snippets['rest_command_purchase_item']).toContain('http://localhost:8099');
  });
});
