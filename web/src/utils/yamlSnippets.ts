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
# TIP: Use content: | (pipe) not content: > (angle bracket) — the pipe
# preserves line breaks needed for markdown rendering in HA cards.
type: markdown
title: 📋 Household Tasks
content: |
  {% set tasks = state_attr('sensor.household_tasks', 'tasks') %}
  {% if tasks %}
  **{{ state_attr('sensor.household_tasks', 'totalPending') }}** pending ({{ state_attr('sensor.household_tasks', 'totalOverdue') }} overdue)
  {% for task in tasks %}
  - **{{ task.title }}**{% if task.assigneeName %} ({{ task.assigneeName }}){% endif %}{% if task.dueDate %} — due {{ task.dueDate | as_timestamp | timestamp_custom('%b %d') }}{% endif %}
  {% endfor %}
  {% else %}
  _Waiting for data..._
  {% endif %}`;
}

function generateMarkdownCardTasksOverdue(): string {
  return `# Markdown Card: Overdue Tasks Only
# Filters tasks by comparing dueDate timestamp to now().
# NOTE: The API does NOT return an isOverdue field per task — you must
# compare dueDate to now() in Jinja. Uses namespace() because HA's
# Jinja2 doesn't allow reassigning variables inside for loops without it.
type: markdown
title: ⚠️ Overdue Tasks
content: |
  {% set tasks = state_attr('sensor.household_tasks', 'tasks') %}
  {% if tasks %}
  {% set ns = namespace(overdue=[]) %}
  {% for task in tasks %}
  {% if task.dueDate and (task.dueDate | as_timestamp(0)) < now().timestamp() %}
  {% set ns.overdue = ns.overdue + [task] %}
  {% endif %}
  {% endfor %}
  {% if ns.overdue | length > 0 %}
  **{{ ns.overdue | length }}** overdue:
  {% for task in ns.overdue %}
  - 🔴 **{{ task.title }}**{% if task.assigneeName %} ({{ task.assigneeName }}){% endif %} — was due {{ task.dueDate | as_timestamp | timestamp_custom('%b %d %H:%M') }}
  {% endfor %}
  {% else %}
  ✅ No overdue tasks!
  {% endif %}
  {% else %}
  _Waiting for data..._
  {% endif %}`;
}

function generateMarkdownCardTasksUser(userName: string): string {
  const sensorName = `sensor.${userName.toLowerCase().replace(/\s+/g, '_')}_tasks`;
  return `# Markdown Card: Tasks for ${userName}
# Uses the per-user sensor to show only this user's tasks.
type: markdown
title: "${userName}'s Tasks"
content: |
  {% if states('${sensorName}') not in ['unavailable', 'unknown'] %}
  **{{ states('${sensorName}') }}** pending ({{ state_attr('${sensorName}', 'overdueCount') }} overdue)
  {% if state_attr('${sensorName}', 'nextTask') %}
  **Next up:** {{ state_attr('${sensorName}', 'nextTask').title }}{% if state_attr('${sensorName}', 'nextTask').dueDate %} — due {{ state_attr('${sensorName}', 'nextTask').dueDate | as_timestamp | timestamp_custom('%b %d') }}{% endif %}
  {% endif %}
  Completed last 7 days: {{ state_attr('${sensorName}', 'completedLast7Days') }}
  {% else %}
  _Waiting for data..._
  {% endif %}`;
}

function generateMarkdownCardShopping(): string {
  return `# Markdown Card: Shopping List
# Shows shopping items grouped by category.
type: markdown
title: 🛒 Shopping List
content: |
  {% set by_cat = state_attr('sensor.shopping_list', 'byCategory') %}
  {% if by_cat %}
  **{{ state_attr('sensor.shopping_list', 'totalUnpurchased') }}** items needed
  {% for category, items in by_cat.items() %}

  **{{ category | capitalize }}**
  {% for item in items %}
  - {{ item.name }}
  {% endfor %}
  {% endfor %}
  {% else %}
  _Waiting for data..._
  {% endif %}`;
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
# IMPORTANT: "rest:" and "rest_command:" are SEPARATE top-level keys.
# If you already have a "rest:" section, ADD the entries below to it.
# If you already have a "rest_command:" section, ADD the entries below to it.
# Do NOT nest rest_command inside rest — they are independent.
#
# Restart HA after saving for changes to take effect.

# --- REST Sensors (top-level key: "rest:") ---
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

# --- REST Commands (SEPARATE top-level key) ---
# This must NOT be indented under "rest:" — it is its own section.
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
