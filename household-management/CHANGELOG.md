# Changelog

All notable changes to the Household Management add-on will be documented in this file.

## [0.5.5-alpha] - 2026-06-26

### Fixed

- Force service worker update: bumped version to trigger HA update detection and new SW activation
- All task UX improvements now properly deployed (backlog tasks, enhanced recurrence, template search, About tab)

## [0.5.4-alpha] - 2026-06-26

### Added

- About section in Settings page showing version, database status, platform, tech stack, and GitHub link

### Fixed

- Service worker caching preventing updates: added skipWaiting + clientsClaim to force immediate activation
- Nginx: index.html and sw.js now served with no-cache headers to prevent stale content after addon updates

## [0.5.3-alpha] - 2026-06-26

### Fixed

- Fix TS18047 in test files compiled by Docker: added non-null assertions for task.dueDate in Task.property.test.ts and ReminderService.test.ts

## [0.5.2-alpha] - 2026-06-26

### Fixed

- Synced household-management/backend-src with backend/src (Docker build uses this copy)
- ReminderService.ts: nullable dueDate/assignedTo in payload and formatReminderMessage
- TaskService.ts: backlog task validation, enhanced recurrence support
- Task model: nullable dueDate, enhanced recurrence fields, serialization helpers
- taskQueries: new recurrence columns, getBacklogTasks, searchTaskTemplates
- taskRoutes: backlog filter, recurrencePattern parsing, template search endpoint
- shoppingRoutes: template search endpoint
- Added recurrenceEngine.ts utility and migration 006 to Docker build context

## [0.5.1-alpha] - 2026-06-26

### Fixed

- Fix TS2322 build error: assigneeName could be null when passed to UserBadge component
- Added non-null assertion on task.assignedTo fallback in TaskCard

## [0.5.0-alpha] - 2026-06-26

### Added

- Enhanced recurrence patterns: "every N days", "every Tuesday", "every 2nd Wednesday", "every 4 weeks on Saturday"
- Backlog tasks: create tasks without a due date or assignee for unscheduled work
- Template search endpoints: autocomplete for task titles and shopping item names (GET /api/tasks/templates/search, GET /api/shopping/templates/search)
- Inline category creation with case-insensitive duplicate detection (409 response)
- RecurrenceEngine utility module with full pattern validation and next-date calculation
- Database migration 006: enhanced recurrence columns, nullable due_date, backlog index

### Changed

- Task form accepts null dueDate and null assignedTo for backlog task creation
- GET /api/tasks supports ?backlog=true filter for backlog-only queries
- Tasks with null due date sort last in task listings
- Backlog tasks are never marked as overdue in frontend or backend

### Fixed

- Frontend TaskCard build error: handle nullable dueDate (TS2538 fix)
- Frontend TaskDashboard: null-safe sorting and overdue filtering for backlog tasks

## [0.4.0-alpha] - 2026-06-24

### Added

- "Anyone" task assignment: tasks can be assigned to all users, appears in everyone's task list
- Time picker for tasks with presets (Morning, Noon, Afternoon, Evening, Custom)
- Overdue task visibility: red time indicator for overdue tasks
- Task filter: "Due / Overdue" to show only overdue/due tasks
- Task sorting: by due date, assignee name, or task title
- "Save as template" opt-in checkbox (replaces auto-save)

### Fixed

- User selector text contrast: names now clearly visible in both light and dark mode
- Template deduplication: no more duplicate templates when creating tasks with same name as existing templates
- Tasks now only show as overdue after both date AND time have passed (not just date)

## [0.3.2-alpha] - 2026-06-24

### Fixed

- Fixed TypeScript build errors in ShoppingList page caused by dynamic categories
- Shopping list now properly displays custom categories (with fallback emoji label)
- Items in custom categories no longer disappear from the list view
- Fixed `AddItemForm` type error when setting initial category from API response

## [0.3.1-alpha] - 2026-06-24

### Fixed

- Shopping lists now use categories configured in Settings (previously rejected custom categories with a validation error)
- Replaced hardcoded category validation with dynamic database-backed lookups (backend)
- Category dropdown in Add Item and Edit Item forms now fetches categories dynamically from the API (frontend)
- Template updates now accept any valid category from the categories table
- Fixed duplicate task/item templates being created on every add-on restart (init-db.sh now idempotent)
- Fixed duplicate templates when running seed.ts multiple times (now uses WHERE NOT EXISTS)
- Fixed duplicate "custom" template created when adding items that match existing pre-populated template names (e.g. "Milk")
- Fixed backend crash on transient database connection errors (no longer calls process.exit)
- Fixed Quick Add templates going to default list instead of the currently viewed shopping list

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
