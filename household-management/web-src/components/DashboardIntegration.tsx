/**
 * DashboardIntegration Component
 *
 * Renders a "Dashboard Integration" section with:
 * - User dropdown for snippet personalization
 * - Collapsible YAML snippet blocks with copy-to-clipboard buttons
 * - Brief explanations for each snippet (what it does, where to paste)
 *
 * Snippets cover: REST sensors, Markdown cards, button cards,
 * rest_commands, open-app button, deep link buttons.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.1, 9.2, 9.3, 9.4
 */

import { useState, useMemo, useCallback } from 'react';
import type { User } from '@/types';
import { generateYamlSnippets } from '@/utils/yamlSnippets';

interface DashboardIntegrationProps {
  users: User[];
  currentUserId: string;
}

interface SnippetInfo {
  key: string;
  title: string;
  description: string;
  pasteLocation: string;
}

const SNIPPET_METADATA: SnippetInfo[] = [
  {
    key: 'rest_sensor_tasks',
    title: 'REST Sensor: Task Summary',
    description: 'Creates a sensor entity that polls your task summary every 30 seconds. Shows total pending/overdue counts and task details as attributes.',
    pasteLocation: 'Add to configuration.yaml under the "rest:" section',
  },
  {
    key: 'rest_sensor_shopping',
    title: 'REST Sensor: Shopping Summary',
    description: 'Creates a sensor entity that polls your shopping list every 30 seconds. Shows total unpurchased count and items grouped by category.',
    pasteLocation: 'Add to configuration.yaml under the "rest:" section',
  },
  {
    key: 'rest_sensor_user',
    title: 'REST Sensor: Per-User Summary',
    description: 'Creates a personalized sensor for the selected user showing their pending/overdue counts, completions in the last 7 days, and next upcoming task.',
    pasteLocation: 'Add to configuration.yaml under the "rest:" section',
  },
  {
    key: 'markdown_card_tasks',
    title: 'Markdown Card: Task List',
    description: 'A Lovelace Markdown card that renders your pending tasks with assignee names and due dates using Jinja2 templates.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
  },
  {
    key: 'markdown_card_shopping',
    title: 'Markdown Card: Shopping List',
    description: 'A Lovelace Markdown card that renders your shopping items grouped by category using Jinja2 templates.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
  },
  {
    key: 'rest_command_complete_task',
    title: 'REST Command: Complete a Task',
    description: 'Defines a rest_command service you can call from button cards or automations to mark a task as completed.',
    pasteLocation: 'Add to configuration.yaml under the "rest_command:" section',
  },
  {
    key: 'rest_command_purchase_item',
    title: 'REST Command: Purchase Shopping Item',
    description: 'Defines a rest_command service you can call from button cards or automations to check off a shopping item.',
    pasteLocation: 'Add to configuration.yaml under the "rest_command:" section',
  },
  {
    key: 'button_card_open_app',
    title: 'Button Card: Open App',
    description: 'A button card that opens the full Household Management app when tapped.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
  },
  {
    key: 'button_card_deep_link',
    title: 'Button Card: Deep Link (My Tasks)',
    description: 'A button card that opens the app filtered to your tasks. Hold to open the create-task form.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
  },
];

function DashboardIntegration({ users, currentUserId }: DashboardIntegrationProps): JSX.Element {
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [ingressPath, setIngressPath] = useState<string>(() => {
    // Derive ingress path from current location, or provide a sensible default
    const pathname = window.location.pathname;
    // HA ingress URLs look like: /api/hassio_ingress/<token>/
    const ingressMatch = pathname.match(/^(\/api\/hassio_ingress\/[^/]+\/)/);
    const matchedPath = ingressMatch?.[1];
    if (matchedPath) {
      return matchedPath;
    }
    // Fallback: use the pathname up to the last segment
    return '/api/hassio_ingress/your-addon-slug/';
  });
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || users[0],
    [users, selectedUserId]
  );

  const backendUrl = useMemo(() => {
    // Backend URL relative to ingress — for HA, it's the same origin via ingress
    const origin = window.location.origin;
    const base = ingressPath.endsWith('/') ? ingressPath.slice(0, -1) : ingressPath;
    return `${origin}${base}`;
  }, [ingressPath]);

  const snippets = useMemo(() => {
    if (!selectedUser) return {};
    return generateYamlSnippets({
      userId: selectedUser.id,
      userName: selectedUser.name,
      ingressPath,
      backendUrl,
    });
  }, [selectedUser, ingressPath, backendUrl]);

  const toggleSnippet = useCallback((key: string) => {
    setExpandedSnippets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(async (key: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSnippets(new Set(SNIPPET_METADATA.map((s) => s.key)));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedSnippets(new Set());
  }, []);

  return (
    <div className="settings-section">
      <h2>Dashboard Integration</h2>
      <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        Copy these YAML snippets into your Home Assistant configuration to display household data
        on your dashboard using native cards, sensors, and commands.
      </p>

      {/* User Selection */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label htmlFor="dashboard-user-select">Personalize snippets for:</label>
        <select
          id="dashboard-user-select"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{ marginTop: 4 }}
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {/* Ingress Path Input */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label htmlFor="dashboard-ingress-path">Ingress path (your add-on&apos;s base URL):</label>
        <input
          id="dashboard-ingress-path"
          type="text"
          value={ingressPath}
          onChange={(e) => setIngressPath(e.target.value)}
          placeholder="/api/hassio_ingress/your-addon-slug/"
          style={{ marginTop: 4 }}
        />
        <p style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          Find this in Settings → Add-ons → Household Management → Info. It looks like{' '}
          <code>/api/hassio_ingress/abc123def/</code>
        </p>
      </div>

      {/* Expand/Collapse All */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn btn--secondary" onClick={expandAll} style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
          Expand All
        </button>
        <button className="btn btn--secondary" onClick={collapseAll} style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
          Collapse All
        </button>
      </div>

      {/* Snippet Sections */}
      <div className="dashboard-snippets">
        {SNIPPET_METADATA.map((meta) => {
          const isExpanded = expandedSnippets.has(meta.key);
          const content = snippets[meta.key] || '';
          const isCopied = copiedKey === meta.key;

          return (
            <div key={meta.key} className="dashboard-snippet-block">
              <button
                className="dashboard-snippet-header"
                onClick={() => toggleSnippet(meta.key)}
                aria-expanded={isExpanded}
              >
                <span className="dashboard-snippet-chevron">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="dashboard-snippet-title">{meta.title}</span>
              </button>

              {isExpanded && (
                <div className="dashboard-snippet-body">
                  <p className="dashboard-snippet-desc">{meta.description}</p>
                  <p className="dashboard-snippet-paste">
                    📋 <strong>Where to paste:</strong> {meta.pasteLocation}
                  </p>
                  <div className="dashboard-snippet-code-wrapper">
                    <pre className="dashboard-snippet-code">
                      <code>{content}</code>
                    </pre>
                    <button
                      className="dashboard-snippet-copy-btn"
                      onClick={() => handleCopy(meta.key, content)}
                      title="Copy to clipboard"
                    >
                      {isCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardIntegration;
