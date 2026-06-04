# Household Management - Home Assistant Add-on Repository

[![Open your Home Assistant instance and show the add add-on repository dialog.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fyour-username%2Fhome-tool)

## About

This repository contains the **Household Management** add-on for Home Assistant. It provides a self-contained household task and shopping list manager that runs directly on your Home Assistant instance and integrates into the sidebar.

## Installation

1. Open Home Assistant
2. Go to **Settings → Add-ons → Add-on Store**
3. Click the three dots menu (⋮) in the top right
4. Select **Repositories**
5. Add this repository URL: `https://github.com/your-username/home-tool`
6. Click **Add**
7. Find "Household Management" in the add-on store and click **Install**

### HACS Installation (Alternative)

1. Open HACS in Home Assistant
2. Go to **Integrations** → three dots menu → **Custom repositories**
3. Add `https://github.com/your-username/home-tool` as an **Add-on** category
4. Install from HACS

## Add-ons

### [Household Management](./household-management)

Manage household tasks and shopping lists from within Home Assistant.

- Appears in the HA sidebar via ingress
- Self-contained PostgreSQL database
- Real-time sync across devices
- REST sensors for dashboard integration
- Multi-architecture: amd64, aarch64, armv7

## Sensor Integration

After installing the add-on, you can add REST sensors to your `configuration.yaml` to display task and shopping data on your dashboards:

```yaml
sensor:
  - platform: rest
    name: "Pending Tasks"
    resource: "http://a0d7b954-household-management:8023/api/tasks?status=pending"
    value_template: "{{ value_json.tasks | length }}"
    unit_of_measurement: "tasks"
    scan_interval: 60

  - platform: rest
    name: "Overdue Tasks"
    resource: "http://a0d7b954-household-management:8023/api/tasks?status=pending&overdue=true"
    value_template: "{{ value_json.tasks | length }}"
    unit_of_measurement: "tasks"
    scan_interval: 60

  - platform: rest
    name: "Shopping List Items"
    resource: "http://a0d7b954-household-management:8023/api/shopping?purchased=false"
    value_template: "{{ value_json.items | length }}"
    unit_of_measurement: "items"
    scan_interval: 60
```

> **Note:** The internal hostname `a0d7b954-household-management` is the default for this add-on. If it differs on your system, check the add-on logs for the correct hostname.

## Dashboard Cards

### Iframe Card (Full App)

```yaml
type: iframe
url: /api/hassio/ingress/a0d7b954_household-management
aspect_ratio: 100%
```

### Entity Cards (Sensors)

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

## Support

- [GitHub Issues](https://github.com/your-username/home-tool/issues)
- [Documentation](./household-management/DOCS.md)
