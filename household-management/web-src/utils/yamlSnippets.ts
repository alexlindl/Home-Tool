/**
 * YAML Snippet Generator for Home Assistant Dashboard Integration
 *
 * Generates ready-to-paste YAML configuration snippets for integrating
 * the Household Management add-on with Home Assistant dashboards.
 *
 * Snippets cover: REST sensors, Markdown cards, button cards,
 * rest_commands, and deep link buttons.
 */

export interface YamlSnippetParams {
  userId: string;
  userName: string;
  ingressPath: string;
  backendUrl: string;
}

/**
 * Generate all YAML snippets for Home Assistant dashboard integration.
 *
 * @param params - User and environment configuration for interpolation
 * @returns Record mapping snippet names to their YAML content
 */
export function generateYamlSnippets(params: {
  userId: string;
  userName: string;
  ingressPath: string;
  backendUrl: string;
}): Record<string, string> {
  const { userId, userName, ingressPath, backendUrl } = params;

  return {
    'rest_sensor_tasks': generateRestSensorTasks(backendUrl),
    'rest_sensor_shopping': generateRestSensorShopping(backendUrl),
    'rest_sensor_user': generateRestSensorUser(userId, userName, backendUrl),
    'markdown_card_tasks': generateMarkdownCardTasks(),
    'markdown_card_shopping': generateMarkdownCardShopping(),
    'button_card_deep_link': generateButtonCardDeepLink(ingressPath, userName),
    'rest_command_complete_task': generateRestCommandCompleteTask(userId, backendUrl),
    'rest_command_purchase_item': generateRestCommandPurchaseItem(userId, backendUrl),
    'button_card_open_app': generateButtonCardOpenApp(ingressPath),
  };
}

function generateRestSensorTasks(backendUrl: string): string {
  return `# REST Sensor: Task Summary
# Add to configuration.yaml under "rest:" or "sensor:" section
# Polls the task summary endpoint every 30 seconds
rest:
  - resource: "${backendUrl}/api/summary/tasks"
    scan_interval: 30
    sensor:
      - name: "Household Tasks"
        value_template: "{{ value_json.totalPending }}"
        unit_of_measurement: "tasks"
        json_attributes:
          - totalPending
          - totalOverdue
          - tasks
          - perUser
          - lastUpdated`;
}

function generateRestSensorShopping(backendUrl: string): string {
  return `# REST Sensor: Shopping Summary
# Add to configuration.yaml under "rest:" or "sensor:" section
# Polls the shopping summary endpoint every 30 seconds
rest:
  - resource: "${backendUrl}/api/summary/shopping"
    scan_interval: 30
    sensor:
      - name: "Shopping List"
        value_template: "{{ value_json.totalUnpurchased }}"
        unit_of_measurement: "items"
        json_attributes:
          - totalUnpurchased
          - items
          - byCategory
          - lastUpdated`;
}

function generateRestSensorUser(userId: string, userName: string, backendUrl: string): string {
  return `# REST Sensor: Per-User Summary for ${userName}
# Add to configuration.yaml under "rest:" or "sensor:" section
# Polls the per-user summary endpoint every 30 seconds
rest:
  - resource: "${backendUrl}/api/summary/user/${userId}"
    scan_interval: 30
    sensor:
      - name: "${userName} Tasks"
        value_template: "{{ value_json.pendingCount }}"
        unit_of_measurement: "tasks"
        json_attributes:
          - userName
          - pendingCount
          - overdueCount
          - completedLast7Days
          - nextTask
          - lastUpdated`;
}

function generateMarkdownCardTasks(): string {
  return `# Markdown Card: Task List
# Add to your Lovelace dashboard as a Markdown card
type: markdown
title: Household Tasks
content: >
  **{{ state_attr('sensor.household_tasks', 'totalPending') }}** pending
  ({{ state_attr('sensor.household_tasks', 'totalOverdue') }} overdue)

  {% for task in state_attr('sensor.household_tasks', 'tasks') %}
  - **{{ task.title }}**{% if task.assigneeName %} ({{ task.assigneeName }}){% endif %}{% if task.dueDate %} — due {{ task.dueDate | as_timestamp | timestamp_custom('%b %d') }}{% endif %}

  {% endfor %}`;
}

function generateMarkdownCardShopping(): string {
  return `# Markdown Card: Shopping List
# Add to your Lovelace dashboard as a Markdown card
type: markdown
title: Shopping List
content: >
  **{{ state_attr('sensor.shopping_list', 'totalUnpurchased') }}** items needed

  {% for category, items in state_attr('sensor.shopping_list', 'byCategory').items() %}
  ### {{ category | capitalize }}
  {% for item in items %}
  - {{ item.name }}
  {% endfor %}
  {% endfor %}`;
}

function generateButtonCardDeepLink(ingressPath: string, _userName: string): string {
  return `# Button Card: Deep Link to App
# Opens the app filtered to your tasks
type: button
name: "My Tasks"
icon: mdi:clipboard-check-outline
tap_action:
  action: navigate
  navigation_path: "${ingressPath}tasks?assignedTo={{ user_id }}"
hold_action:
  action: navigate
  navigation_path: "${ingressPath}tasks?action=create"
show_name: true
show_icon: true`;
}

function generateRestCommandCompleteTask(userId: string, backendUrl: string): string {
  return `# REST Command: Complete a Task
# Add to configuration.yaml under "rest_command:"
# Call via service: rest_command.complete_household_task
rest_command:
  complete_household_task:
    url: "${backendUrl}/api/tasks/{{ task_id }}/complete"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"userId": "${userId}"}'`;
}

function generateRestCommandPurchaseItem(userId: string, backendUrl: string): string {
  return `# REST Command: Purchase Shopping Item
# Add to configuration.yaml under "rest_command:"
# Call via service: rest_command.purchase_shopping_item
rest_command:
  purchase_shopping_item:
    url: "${backendUrl}/api/shopping/{{ item_id }}/purchase"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"userId": "${userId}"}'`;
}

function generateButtonCardOpenApp(ingressPath: string): string {
  return `# Button Card: Open Household Management App
# Add to your Lovelace dashboard as a button card
# Opens the full app via ingress
type: button
name: "Household Management"
icon: mdi:home-assistant
tap_action:
  action: navigate
  navigation_path: "${ingressPath}"
show_name: true
show_icon: true`;
}
