# Home Assistant Dashboard Integration

This guide explains how to integrate the Household Management add-on with your Home Assistant dashboard using native HA features: REST sensors, Markdown cards, button cards, and REST commands.

## Overview

The add-on exposes a **Summary API** that returns JSON data optimized for HA sensor consumption. HA polls these endpoints every 30 seconds using REST sensors, and you display the data using Lovelace cards.

**Architecture:**

```
┌─────────────────────┐          ┌──────────────────────────────┐
│  Home Assistant      │          │  Household Management Add-on │
│                      │  HTTP    │                              │
│  REST Sensors ──────────────────▶ /api/summary/tasks          │
│  REST Commands ─────────────────▶ /api/summary/shopping       │
│  Button Cards ──────────┐       │ /api/summary/user/:id       │
│  Markdown Cards         │       └──────────────────────────────┘
└─────────────────────────┘
                          │
                    Direct port access (http://HOST:8023)
                    for deep-link button cards
```

### Key Concepts

- **REST Sensors** — Defined in `configuration.yaml`. HA polls the API and creates sensor entities you can use in templates and automations.
- **Markdown Cards** — Lovelace cards that render Jinja2 templates using sensor attributes.
- **Button Cards** — Lovelace cards that open URLs or trigger services when tapped.
- **REST Commands** — Services defined in `configuration.yaml` that POST to the API (e.g., completing a task).

### Important: URL Patterns

| Use case | URL format | Example |
|----------|-----------|---------|
| REST sensors / commands (internal API) | Direct port | `http://HA_IP:8023/api/summary/tasks` |
| Button card deep links (open the app) | Direct port | `http://HA_IP:8023/#/tasks?assignedTo=USER_ID` |

**Why direct port?**
- REST sensors run server-side within HA — ingress URLs do **not** work for REST sensors because they require authentication tokens that the REST integration cannot provide. Use the direct port (`http://HOST:8023`) instead.
- Button cards with `action: url` open a browser tab — they also need the direct port (8023) that the add-on exposes.
- The app uses **HashRouter** in Docker, so all deep links include `#` in the path (e.g., `/#/shopping`).
- HA's `action: navigate` only works for HA internal paths — always use `action: url` with `url_path` for this app.

---

## Summary API Reference

### GET /api/summary/tasks

Returns aggregated task data.

**Query parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `assignedTo` | string | Filter by user ID |
| `listId` | string | Filter by task list ID |
| `limit` | integer | Max tasks in response array |

**Response:**
```json
{
  "totalPending": 5,
  "totalOverdue": 2,
  "tasks": [
    {
      "id": "...",
      "title": "Take out trash",
      "assigneeName": "Alex",
      "dueDate": "2024-01-15T00:00:00.000Z"
    }
  ],
  "perUser": { "user-id": { "pending": 3, "overdue": 1 } },
  "lastUpdated": "2024-01-15T12:00:00.000Z"
}
```

> **Note:** Each task object contains `title`, `assigneeName`, and `dueDate`. There is no `isOverdue` field per task — overdue detection must compare `dueDate` to `now()` in Jinja templates.

### GET /api/summary/shopping

Returns aggregated shopping list data.

**Query parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `listId` | string | Filter by shopping list ID |
| `limit` | integer | Max items in response array |

**Response:**
```json
{
  "totalUnpurchased": 8,
  "items": [...],
  "byCategory": {
    "produce": [{ "name": "Bananas", "quantity": 1 }],
    "dairy": [{ "name": "Milk", "quantity": 2 }]
  },
  "lastUpdated": "2024-01-15T12:00:00.000Z"
}
```

### GET /api/summary/user/:userId

Returns per-user summary.

**Response:**
```json
{
  "userName": "Alex",
  "pendingCount": 3,
  "overdueCount": 1,
  "completedLast7Days": 7,
  "nextTask": {
    "title": "Vacuum living room",
    "dueDate": "2024-01-16T00:00:00.000Z"
  },
  "lastUpdated": "2024-01-15T12:00:00.000Z"
}
```

---

## Complete configuration.yaml Example

Add this to your `configuration.yaml` and restart Home Assistant:

```yaml
# ============================================================
# Household Management Integration
# ============================================================
# Replace HOSTNAME with your HA device's IP or hostname, e.g.:
#   http://192.168.1.100:8023 or http://homeassistant.local:8023
#
# IMPORTANT: Use the direct port (8023), NOT ingress URLs.
# Ingress URLs require authentication tokens that REST sensors cannot provide.

# --- REST Sensors ---
rest:
  # All tasks
  - resource: "http://HOSTNAME:8023/api/summary/tasks"
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
  - resource: "http://HOSTNAME:8023/api/summary/shopping"
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

  # Per-user summary (replace USER_ID and USER_NAME)
  - resource: "http://HOSTNAME:8023/api/summary/user/USER_ID"
    scan_interval: 30
    sensor:
      - name: "USER_NAME Tasks"
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
    url: "http://HOSTNAME:8023/api/tasks/{{ task_id }}/complete"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"userId": "USER_ID"}'

  purchase_shopping_item:
    url: "http://HOSTNAME:8023/api/shopping/{{ item_id }}/purchase"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"userId": "USER_ID"}'
```

---

## Dashboard Card Examples

> **Tips:**
> - Use `content: |` (pipe) not `content: >` (angle bracket) — the pipe preserves line breaks needed for markdown rendering.
> - HA's Jinja2 doesn't allow reassigning variables inside `for` loops without `namespace()`.
> - The API returns `title`, `assigneeName`, and `dueDate` per task — there is no `isOverdue` field. Overdue detection must compare `dueDate` to `now()` in Jinja.
> - REST sensors must use the direct port (`http://HOST:8023`), not ingress URLs.

### Markdown Card: All Tasks

```yaml
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
  {% endif %}
```

### Markdown Card: Overdue Tasks Only

```yaml
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
  {% endif %}
```

### Markdown Card: Shopping List

```yaml
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
  {% endif %}
```

### Button Card: Open App

```yaml
type: button
name: "Household Management"
icon: mdi:home-assistant
tap_action:
  action: url
  url_path: "http://HOSTNAME:8023/"
show_name: true
show_icon: true
```

### Button Card: My Tasks (Deep Link)

```yaml
type: button
name: "My Tasks"
icon: mdi:clipboard-check-outline
tap_action:
  action: url
  url_path: "http://HOSTNAME:8023/#/tasks?assignedTo=USER_ID"
show_name: true
show_icon: true
```

### Button Card: Shopping List

```yaml
type: button
name: "Shopping List"
icon: mdi:cart-outline
tap_action:
  action: url
  url_path: "http://HOSTNAME:8023/#/shopping"
show_name: true
show_icon: true
```

### Button Card: Create Task

```yaml
type: button
name: "New Task"
icon: mdi:plus-circle-outline
tap_action:
  action: url
  url_path: "http://HOSTNAME:8023/#/tasks?action=create"
show_name: true
show_icon: true
```

---

## Deep Link Reference

The app uses HashRouter, so all paths are prefixed with `/#/`.

| Deep Link Path | Description |
|---------------|-------------|
| `/#/` | Home / dashboard |
| `/#/tasks` | All tasks |
| `/#/tasks?assignedTo=USER_ID` | Tasks filtered to a specific user |
| `/#/tasks?action=create` | Open the create-task form |
| `/#/tasks?listId=LIST_ID` | Tasks filtered to a specific list |
| `/#/shopping` | Shopping list |
| `/#/shopping?listId=LIST_ID` | Specific shopping list |
| `/#/settings` | Settings page |

**Full URL format:** `http://HOSTNAME:8023/#/path?params`

Replace `HOSTNAME` with your HA device's IP or hostname (e.g., `192.168.1.100` or `homeassistant.local`).

---

## Troubleshooting

### Sensors show "unavailable" or "unknown"

1. **Check the add-on is running** — Go to Settings → Add-ons → Household Management and verify it shows "Running".
2. **Verify port 8023 is accessible** — In your browser, visit `http://YOUR_HA_IP:8023/api/summary/tasks`. You should see JSON data.
3. **Do NOT use ingress URLs for REST sensors** — Ingress URLs require HA authentication tokens that the REST integration cannot provide. Always use the direct port: `http://YOUR_HA_IP:8023/api/summary/tasks`.
4. **Check HA logs** — Go to Settings → System → Logs and filter for "rest" to see polling errors.

### Button cards don't open the app

1. **Don't use `action: navigate`** — HA's navigate action only works for HA internal paths (like `/lovelace/`, `/config/`). The app is external, so you must use `action: url`.
2. **Check port 8023 is accessible** — In your browser, visit `http://YOUR_HA_IP:8023/`. If it doesn't load, the port may not be exposed. Check the add-on configuration and ensure port 8023 is mapped.
3. **Verify HashRouter format** — Deep links must include `#` before the path: `http://HOST:8023/#/tasks` (not `http://HOST:8023/tasks`).

### REST commands return errors

1. **Check the task/item ID** — IDs are UUIDs. Verify the ID exists by checking the API response in the sensor attributes.
2. **Check the user ID** — The `userId` in the payload must be a valid user ID from your household.
3. **Test with Developer Tools** — Go to Developer Tools → Services, select `rest_command.complete_household_task`, and provide `task_id` in the service data.

### Data is stale / not updating

- REST sensors poll every 30 seconds by default (`scan_interval: 30`). If you need faster updates, reduce this value (minimum recommended: 10).
- After changing `configuration.yaml`, you must fully restart HA (not just reload). Go to Settings → System → Restart.
- The API returns `Cache-Control: max-age=30` headers, which align with the default poll interval.

### Sensors work but Markdown cards show errors

- Ensure the sensor entity name matches what you used in `state_attr()`. Check Developer Tools → States to see exact entity IDs.
- HA converts sensor names to entity IDs by lowercasing and replacing spaces with underscores: "Household Tasks" → `sensor.household_tasks`.
- If attributes show as `None`, the API might be returning empty data. Check if there are actually tasks/items in the app.
