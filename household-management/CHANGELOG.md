# Changelog

All notable changes to the Household Management add-on will be documented in this file.

## [0.3.1-alpha] - 2026-06-24

### Fixed

- Shopping lists now use categories configured in Settings (previously rejected custom categories with a validation error)
- Replaced hardcoded category validation with dynamic database-backed lookups (backend)
- Category dropdown in Add Item and Edit Item forms now fetches categories dynamically from the API (frontend)
- Template updates now accept any valid category from the categories table

### Changed

- Sidebar panel icon updated from `mdi:home-assistant` to `mdi:clipboard-check-outline`
- Generated proper icon.png (128×128) and logo.png (256×256) for the add-on store (were placeholder text files)

## [0.2.0-alpha] - 2026-06-04

### Added

- Light/dark mode support
- Factory reset functionality
- Backup & restore

### Fixed

- Hide indicator app when offline (for HA)
- Multiple fixes for post-reset behaviour
- Reset versioning from 1.0.0 to 0.1.0-alpha
- Deleted old build.yaml
- api.ts build issue
- Task delete and SQL duplication
- Ingress web portal and list add permissions
- All /data references fixed to /config
- Copy vite-env.d.ts into the add-on's web source
- Removed image field and duplicate add-on folder

### Changed

- Removed port setting in UI

## [0.1.0-alpha] - 2026-06-04

### Added

- Initial release as Home Assistant add-on
- Task management with creation, assignment, completion, and recurrence
- Shopping list with categories and purchase tracking
- Multiple lists support (task lists and shopping lists)
- PostgreSQL database self-contained in the add-on
- Nginx reverse proxy with ingress support for HA sidebar
- Real-time synchronization via WebSocket (Socket.io)
- REST API endpoints for Home Assistant sensor integration
- Multi-architecture support: amd64, aarch64
