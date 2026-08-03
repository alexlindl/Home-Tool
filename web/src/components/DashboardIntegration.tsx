/**
 * DashboardIntegration Component
 *
 * Renders a "Dashboard Integration" section with:
 * - User dropdown for snippet personalization
 * - Host/Port input for button card URLs (direct port access)
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
  group: string;
}

const SNIPPET_METADATA: SnippetInfo[] = [
  // --- REST Sensors ---
  {
    key: 'rest_sensor_tasks',
    title: 'REST Sensor: All Tasks',
    description: 'Creates a sensor entity that polls your task summary every 30 seconds. State = total pending count. Attributes include the full task list, per-user breakdown, and overdue count.',
    pasteLocation: 'Add to configuration.yaml under the "rest:" section',
    group: 'REST Sensors',
  },
  {
    key: 'rest_sensor_tasks_overdue',
    title: 'REST Sensor: Overdue Tasks',
    description: 'Creates a sensor whose state is the overdue task count. Uses the same endpoint but extracts overdue-specific data via the value_template.',
    pasteLocation: 'Add to configuration.yaml under the "rest:" section',
    group: 'REST Sensors',
  },
  {
    key: 'rest_sensor_shopping',
    title: 'REST Sensor: Shopping Summary',
    description: 'Creates a sensor entity that polls your shopping list every 30 seconds. State = total unpurchased count. Attributes hold items grouped by category.',
    pasteLocation: 'Add to configuration.yaml under the "rest:" section',
    group: 'REST Sensors',
  },
  {
    key: 'rest_sensor_user',
    title: 'REST Sensor: Per-User Summary',
    description: 'Creates a personalized sensor for the selected user showing their pending/overdue counts, completions in the last 7 days, and next upcoming task.',
    pasteLocation: 'Add to configuration.yaml under the "rest:" section',
    group: 'REST Sensors',
  },

  // --- Markdown Cards ---
  {
    key: 'markdown_card_tasks_all',
    title: 'Markdown Card: All Tasks',
    description: 'A Lovelace Markdown card that renders all pending tasks with assignee names, due dates, and an overdue indicator.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
    group: 'Markdown Cards',
  },
  {
    key: 'markdown_card_tasks_overdue',
    title: 'Markdown Card: Overdue Tasks',
    description: 'A Markdown card that filters to only show overdue tasks. Displays a friendly "No overdue tasks!" message when all clear.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
    group: 'Markdown Cards',
  },
  {
    key: 'markdown_card_tasks_user',
    title: 'Markdown Card: My Tasks',
    description: 'A Markdown card showing only the selected user\'s pending count, next task, and recent completions. Uses the per-user sensor.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
    group: 'Markdown Cards',
  },
  {
    key: 'markdown_card_shopping',
    title: 'Markdown Card: Shopping List',
    description: 'A Lovelace Markdown card that renders your shopping items grouped by category with quantity indicators.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
    group: 'Markdown Cards',
  },

  // --- Button Cards ---
  {
    key: 'button_card_open_app',
    title: 'Button Card: Open App',
    description: 'A button card that opens the full Household Management app via direct port access. Uses action "url" (not "navigate") since this is not an HA internal path.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
    group: 'Button Cards',
  },
  {
    key: 'button_card_my_tasks',
    title: 'Button Card: My Tasks',
    description: 'A button card that deep-links to the app filtered to the selected user\'s tasks. Uses HashRouter format for proper routing.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
    group: 'Button Cards',
  },
  {
    key: 'button_card_shopping',
    title: 'Button Card: Shopping List',
    description: 'A button card that deep-links directly to the shopping list view.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
    group: 'Button Cards',
  },
  {
    key: 'button_card_create_task',
    title: 'Button Card: Create Task',
    description: 'A button card that deep-links to the create-task form so you can quickly add a new task from the HA dashboard.',
    pasteLocation: 'Add as a Manual Card in your Lovelace dashboard (YAML mode)',
    group: 'Button Cards',
  },

  // --- REST Commands ---
  {
    key: 'rest_command_complete_task',
    title: 'REST Command: Complete a Task',
    description: 'Defines a rest_command service you can call from button cards or automations to mark a task as completed. Pass task_id as a template variable.',
    pasteLocation: 'Add to configuration.yaml under the "rest_command:" section',
    group: 'REST Commands',
  },
  {
    key: 'rest_command_purchase_item',
    title: 'REST Command: Purchase Shopping Item',
    description: 'Defines a rest_command service you can call from button cards or automations to check off a shopping item. Pass item_id as a template variable.',
    pasteLocation: 'Add to configuration.yaml under the "rest_command:" section',
    group: 'REST Commands',
  },

  // --- Full Configuration ---
  {
    key: 'configuration_yaml_full',
    title: 'Full configuration.yaml Example',
    description: 'A complete configuration.yaml snippet combining all REST sensors and REST commands. Copy this as a starting point and customize as needed.',
    pasteLocation: 'Add to your configuration.yaml (merge with existing rest: and rest_command: sections)',
    group: 'Full Configuration',
  },
];

function DashboardIntegration({ users, currentUserId }: DashboardIntegrationProps): JSX.Element {
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [ingressPath, setIngressPath] = useState<string>(() => {
    const pathname = window.location.pathname;
    const ingressMatch = pathname.match(/^(\/api\/hassio_ingress\/[^/]+\/)/);
    const matchedPath = ingressMatch?.[1];
    if (matchedPath) {
      return matchedPath;
    }
    return '/api/hassio_ingress/your-addon-slug/';
  });
  const [hostPort, setHostPort] = useState<string>(() => {
    return `${window.location.hostname}:8023`;
  });
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || users[0],
    [users, selectedUserId]
  );

  const backendUrl = useMemo(() => {
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
      hostPort,
    });
  }, [selectedUser, ingressPath, backendUrl, hostPort]);

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

  // Group snippets for section headers
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const meta of SNIPPET_METADATA) {
      if (!seen.has(meta.group)) {
        seen.add(meta.group);
        result.push(meta.group);
      }
    }
    return result;
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
        <label htmlFor="dashboard-ingress-path">Ingress path (add-on&apos;s internal API URL):</label>
        <input
          id="dashboard-ingress-path"
          type="text"
          value={ingressPath}
          onChange={(e) => setIngressPath(e.target.value)}
          placeholder="/api/hassio_ingress/your-addon-slug/"
          style={{ marginTop: 4 }}
        />
        <p style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          Used for REST sensor and REST command URLs. Find this in Settings → Add-ons → Household Management → Info.
        </p>
      </div>

      {/* Host/Port Input */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label htmlFor="dashboard-host-port">Host &amp; port (for button card deep links):</label>
        <input
          id="dashboard-host-port"
          type="text"
          value={hostPort}
          onChange={(e) => setHostPort(e.target.value)}
          placeholder="192.168.1.100:8023"
          style={{ marginTop: 4 }}
        />
        <p style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          Direct port access URL for button cards (HA &quot;navigate&quot; only works for HA internal paths).
          Default port is 8023. Example: <code>192.168.1.100:8023</code> or <code>homeassistant.local:8023</code>
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
        {groups.map((group) => {
          const groupSnippets = SNIPPET_METADATA.filter((m) => m.group === group);
          return (
            <div key={group} className="dashboard-snippet-group">
              <h3 style={{ fontSize: '0.9375rem', margin: '16px 0 8px', color: 'var(--color-text-primary)' }}>
                {group}
              </h3>
              {groupSnippets.map((meta) => {
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
          );
        })}
      </div>
    </div>
  );
}

export default DashboardIntegration;
