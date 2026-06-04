# Household Management Add-on Documentation

## Overview

The Household Management add-on provides a complete household task and shopping list manager running directly on your Home Assistant instance. It appears in your sidebar for quick access and stores all data locally in a self-contained PostgreSQL database.

## Features

- **Task Management**: Create, assign, and track household tasks with due dates and recurrence
- **Shopping Lists**: Manage shopping items with categories and purchase tracking
- **Multiple Lists**: Organize tasks and shopping items into separate lists
- **Real-time Sync**: Changes sync instantly across all connected devices via WebSocket
- **Sidebar Access**: Integrated directly into the HA sidebar via ingress
- **Dashboard Sensors**: REST sensors for Lovelace dashboard cards
- **Self-contained**: PostgreSQL database runs inside the add-on container

## Architecture

The add-on runs three services inside a single container:

1. **PostgreSQL 16** — stores all task, shopping, and user data in `/config/postgres`
2. **Node.js Backend** — REST API on port 3000 (internal)
3. **Nginx** — serves the web UI and proxies API requests on port 8023

Data persists in the `/data/` directory which is mapped to the add-on's persistent storage on your HA instance.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `db_password` | `household123` | PostgreSQL password for the app database user |
| `db_name` | `household_app` | Database name |
| `db_user` | `household` | Database username |

### Changing the Database Password

1. Go to **Settings → Add-ons → Household Management → Configuration**
2. Update the `db_password` field
3. Restart the add-on

> **Note:** Changing the password after initial setup requires manually updating the PostgreSQL user password. The simplest approach is to uninstall and reinstall the add-on (this will reset the database).

## Sensor Integration

Add REST sensors to your `configuration.yaml` for dashboard use:

```yaml
sensor:
  - platform: rest
    name: "Pending Tasks"
    resource: "http://a0d7b954-household-management:8023/api/tasks?status=pending"
    value_template: "{{ value_json.tasks | length }}"
    unit_of_measurement: "tasks"
    scan_interval: 60
    icon: mdi:clipboard-list

  - platform: rest
    name: "Overdue Tasks"
    resource: "http://a0d7b954-household-management:8023/api/tasks?status=pending&overdue=true"
    value_template: "{{ value_json.tasks | length }}"
    unit_of_measurement: "tasks"
    scan_interval: 60
    icon: mdi:clipboard-alert

  - platform: rest
    name: "Shopping List Items"
    resource: "http://a0d7b954-household-management:8023/api/shopping?purchased=false"
    value_template: "{{ value_json.items | length }}"
    unit_of_measurement: "items"
    scan_interval: 60
    icon: mdi:cart
```

After adding sensors, restart Home Assistant Core to pick them up.

## Dashboard Cards

### Full App in Iframe

Embed the entire app in a dashboard panel:

```yaml
type: iframe
url: /api/hassio/ingress/a0d7b954_household-management
aspect_ratio: 100%
```

### Sensor Entity Cards

Display task and shopping counts:

```yaml
type: entities
title: Household Status
entities:
  - entity: sensor.pending_tasks
    name: Pending Tasks
    icon: mdi:clipboard-list
  - entity: sensor.overdue_tasks
    name: Overdue Tasks
    icon: mdi:clipboard-alert
  - entity: sensor.shopping_list_items
    name: Shopping Items
    icon: mdi:cart
```

### Glance Card

Quick overview of household status:

```yaml
type: glance
title: Household Overview
entities:
  - entity: sensor.pending_tasks
    name: Tasks
    icon: mdi:clipboard-check
  - entity: sensor.overdue_tasks
    name: Overdue
    icon: mdi:alert-circle
  - entity: sensor.shopping_list_items
    name: Shopping
    icon: mdi:cart-outline
```

### Markdown Card (Detailed Task List)

Show task details using a template:

```yaml
type: markdown
title: Upcoming Tasks
content: >
  {% set tasks = state_attr('sensor.pending_tasks', 'tasks') %}
  {% if tasks %}
    {% for task in tasks[:5] %}
    - **{{ task.title }}** — due {{ task.due_date | as_timestamp | timestamp_custom('%b %d') }}
    {% endfor %}
  {% else %}
    No pending tasks!
  {% endif %}
```

## Automations

### Notify on Overdue Tasks

```yaml
automation:
  - alias: "Notify overdue household tasks"
    trigger:
      - platform: numeric_state
        entity_id: sensor.overdue_tasks
        above: 0
    action:
      - service: notify.mobile_app_phone
        data:
          title: "Overdue Tasks"
          message: "You have {{ states('sensor.overdue_tasks') }} overdue household task(s)!"
```

### Complete Task via Script

```yaml
script:
  complete_task:
    alias: "Complete a Household Task"
    sequence:
      - service: rest_command.complete_task
        data:
          task_id: "{{ task_id }}"
          user_id: "{{ user_id }}"

rest_command:
  complete_task:
    url: "http://a0d7b954-household-management:8023/api/tasks/{{ task_id }}/complete"
    method: POST
    headers:
      Content-Type: application/json
    payload: '{"userId": "{{ user_id }}"}'
```

## Troubleshooting

### Add-on won't start

1. Check the add-on logs: **Settings → Add-ons → Household Management → Log**
2. Common issues:
   - Port 8023 conflict: Change the port in the add-on configuration
   - Database corruption: Stop the add-on, delete the `/config/postgres` directory, restart

### Can't access from sidebar

1. Ensure `ingress: true` is set (it is by default)
2. Try restarting the add-on
3. Clear browser cache and reload HA

### Sensors not updating

1. Verify the add-on is running and healthy
2. Check the internal hostname in the add-on logs
3. Test the API manually: browse to `http://your-ha-ip:8023/api/tasks`
4. Ensure `scan_interval` is set in your sensor config

### Database reset

To completely reset the database:

1. Stop the add-on
2. Use SSH or Terminal add-on to remove `/addon_configs/a0d7b954_household-management/`
3. Start the add-on — it will reinitialize the database

## Backup & Restore

The add-on data is included in Home Assistant's full backups. The PostgreSQL data lives in `/config/postgres` which is persisted across restarts and updates.

To manually back up:
1. Stop the add-on
2. Copy `/addon_configs/a0d7b954_household-management/` to a safe location
3. Start the add-on

## System Requirements

- Home Assistant OS or Supervised installation
- Minimum 512MB RAM available for the add-on
- ~200MB disk space for the container
- Tested on: Home Assistant Green (aarch64), generic x86-64
