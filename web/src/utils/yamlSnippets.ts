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
  hostPort?: string;
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
  hostPort?: string;
}): Record<string, string> {
  const { userId, userName, ingressPath: _ingressPath, backendUrl, hostPort } = params;

  // Derive the direct-access base URL for button cards
  // hostPort should be like "192.168.1.100:8023" or "homeassistant.local:8023"
  const directUrl = hostPort
    ? `http://${hostPort}`
    : `http://HOSTNAME:8023`;

  return {
    // REST Sensors
    'rest_sensor_tasks': generateRestSensorTasks(backendUrl),
    'rest_sensor_tasks_overdue': generateRestSensorTasksOverdue(backendUrl),
    'rest_sensor_shopping': generateRestSensorShopping(backendUrl),
    'rest_sensor_user': generateRestSensorUser(userId, userName, backendUrl),

    // Markdown Cards
    'markdown_card_tasks_all': generateMarkdownCardTasksAll(),
    'markdown_card_tasks_overdue': generateMarkdownCardTasksOverdue(),
    'markdown_card_tasks_user': generateMarkdownCardTasksUser(userName),
    'markdown_card_shopping': generateMarkdownCardShopping(),

    // Button Cards
    'button_card_open_app': generateButtonCardOpenApp(directUrl),
    'button_card_my_tasks': generateButtonCardMyTasks(directUrl, userId, userName),
    'button_card_shopping': generateButtonCardShopping(directUrl),
    'button_card_create_task': generateButtonCardCreateTask(directUrl),

    // REST Commands
    'rest_command_complete_task': generateRestCommandCompleteTask(userId, backendUrl),
    'rest_command_purchase_item': generateRestCommandPurchaseItem(userId, backendUrl),

    // Full Configuration Example
    'configuration_yaml_full': generateConfigurationYamlFull(userId, userName, backendUrl),
  };
}

// ---------------------------------------------------------------------------
// REST Sensors
// ---------------------------------------------------------------------------

function generateRestSensorTasks(backendUrl: string): string {
  return `# REST Sensor: Task Summary
# Polls the task summary endpoint every 30 seconds.
# State = total pending count; attributes hold the full task list.
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

function generateRestSensorTasksOverdue(backendUrl: string): string {
  return `# REST Sensor: Overdue Tasks
# Same endpoint as above, but the value_template extracts overdue count
# and the tasks attribute is filtered to only overdue items.
rest:
  - resource: "${backendUrl}/api/summary/tasks"
    scan_interval: 30
    sensor:
      - name: "Household Tasks Overdue"
        value_template: "{{ value_json.totalOverdue }}"
        unit_of_measurement: "tasks"
        json_attributes_path: "$"
        json_attributes:
          - totalOverdue
          - tasks
          - lastUpdated`;
}

function generateRestSensorShopping(backendUrl: string): string {
  return `# REST Sensor: Shopping Summary
# Polls the shopping summary endpoint every 30 seconds.
# State = total unpurchased count; attributes hold items by category.
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
# Polls the per-user summary endpoint every 30 seconds.
# State = pending count for this user.
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

// ---------------------------------------------------------------------------
// Markdown Cards
// ---------------------------------------------------------------------------

function generateMarkdownCardTasksAll(): string {
  return `# Markdown Card: All Pending Tasks
# Shows every pending task with assignee and due date.
type: markdown
title: Household Tasks
content: >
  **{{ state_attr('sensor.household_tasks', 'totalPending') }}** pending
  ({{ state_attr('sensor.household_tasks', 'totalOverdue') }} overdue)

  {% for task in state_attr('sensor.household_tasks', 'tasks') %}
  - **{{ task.title }}**{% if task.assigneeName %} ({{ task.assigneeName }}){% endif %}{% if task.dueDate %} — due {{ task.dueDate | as_timestamp | timestamp_custom('%b %d') }}{% endif %}{% if task.isOverdue %} 🔴{% endif %}

  {% endfor %}`;
}

function generateMarkdownCardTasksOverdue(): string {
  return `# Markdown Card: Overdue Tasks Only
# Filters to show only tasks that are past their due date.
type: markdown
title: Overdue Tasks
content: >
  {% set overdue_tasks = state_attr('sensor.household_tasks', 'tasks') | selectattr('isOverdue', 'equalto', true) | list %}
  {% if overdue_tasks | length > 0 %}
  **{{ overdue_tasks | length }}** overdue:

  {% for task in overdue_tasks %}
  - 🔴 **{{ task.title }}**{% if task.assigneeName %} ({{ task.assigneeName }}){% endif %}{% if task.dueDate %} — was due {{ task.dueDate | as_timestamp | timestamp_custom('%b %d') }}{% endif %}

  {% endfor %}
  {% else %}
  ✅ No overdue tasks!
  {% endif %}`;
}

function generateMarkdownCardTasksUser(userName: string): string {
  const sensorName = `sensor.${userName.toLowerCase().replace(/\s+/g, '_')}_tasks`;
  return `# Markdown Card: Tasks for ${userName}
# Uses the per-user sensor to show only this user's tasks.
type: markdown
title: "${userName}'s Tasks"
content: >
  **{{ states('${sensorName}') }}** pending
  ({{ state_attr('${sensorName}', 'overdueCount') }} overdue)

  {% if state_attr('${sensorName}', 'nextTask') %}
  **Next up:** {{ state_attr('${sensorName}', 'nextTask').title }}{% if state_attr('${sensorName}', 'nextTask').dueDate %} — due {{ state_attr('${sensorName}', 'nextTask').dueDate | as_timestamp | timestamp_custom('%b %d') }}{% endif %}

  {% endif %}
  Completed last 7 days: {{ state_attr('${sensorName}', 'completedLast7Days') }}`;
}

function generateMarkdownCardShopping(): string {
  return `# Markdown Card: Shopping List
# Shows shopping items grouped by category.
type: markdown
title: Shopping List
content: >
  **{{ state_attr('sensor.shopping_list', 'totalUnpurchased') }}** items needed

  {% for category, items in state_attr('sensor.shopping_list', 'byCategory').items() %}
  ### {{ category | capitalize }}
  {% for item in items %}
  - {{ item.name }}{% if item.quantity and item.quantity > 1 %} (x{{ item.quantity }}){% endif %}

  {% endfor %}
  {% endfor %}`;
}

// ---------------------------------------------------------------------------
// Button Cards
// ---------------------------------------------------------------------------

function generateButtonCardOpenApp(directUrl: string): string {
  return `# Button Card: Open Household Management App
# Opens the full app via direct port access.
# NOTE: action "url" opens an external URL — required for non-HA paths.
type: button
name: "Household Management"
icon: mdi:home-assistant
tap_action:
  action: url
  url_path: "${directUrl}/"
show_name: true
show_icon: true`;
}

function generateButtonCardMyTasks(directUrl: string, userId: string, userName: string): string {
  return `# Button Card: Open My Tasks (${userName})
# Deep-links to the app filtered to this user's tasks.
# Uses HashRouter format: /#/path?params
type: button
name: "${userName}'s Tasks"
icon: mdi:clipboard-check-outline
tap_action:
  action: url
  url_path: "${directUrl}/#/tasks?assignedTo=${userId}"
show_name: true
show_icon: true`;
}

function generateButtonCardShopping(directUrl: string): string {
  return `# Button Card: Open Shopping List
# Deep-links to the shopping list view.
type: button
name: "Shopping List"
icon: mdi:cart-outline
tap_action:
  action: url
  url_path: "${directUrl}/#/shopping"
show_name: true
show_icon: true`;
}

function generateButtonCardCreateTask(directUrl: string): string {
  return `# Button Card: Create New Task
# Deep-links to the task creation form.
type: button
name: "New Task"
icon: mdi:plus-circle-outline
tap_action:
  action: url
  url_path: "${directUrl}/#/tasks?action=create"
show_name: true
show_icon: true`;
}

// ---------------------------------------------------------------------------
// REST Commands
// ---------------------------------------------------------------------------

function generateRestCommandCompleteTask(userId: string, backendUrl: string): string {
  return `# REST Command: Complete a Task
# Call via service: rest_command.complete_household_task
# Pass task_id as a service data template variable.
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
# Call via service: rest_command.purchase_shopping_item
# Pass item_id as a service data template variable.
rest_command:
  purchase_shopping_item:
    url: "${backendUrl}/api/shopping/{{ item_id }}/purchase"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"userId": "${userId}"}'`;
}

// ---------------------------------------------------------------------------
// Full Configuration Example
// ---------------------------------------------------------------------------

function generateConfigurationYamlFull(userId: string, userName: string, backendUrl: string): string {
  return `# ============================================================
# Household Management — Full configuration.yaml example
# ============================================================
# Add the sections below to your Home Assistant configuration.yaml.
# Restart HA after saving for REST sensors to load.

# --- REST Sensors ---
rest:
  # All tasks
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
          - lastUpdated

  # Shopping list
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
          - lastUpdated

  # Per-user summary (${userName})
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
          - lastUpdated

# --- REST Commands ---
rest_command:
  complete_household_task:
    url: "${backendUrl}/api/tasks/{{ task_id }}/complete"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"userId": "${userId}"}'

  purchase_shopping_item:
    url: "${backendUrl}/api/shopping/{{ item_id }}/purchase"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"userId": "${userId}"}'`;
}
