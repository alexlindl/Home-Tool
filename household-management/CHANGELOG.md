# Changelog

All notable changes to the Household Management add-on will be documented in this file.

## [0.6.5-alpha] - 2026-07-01

### Added
- HA user linking now shows a dropdown of person entities fetched from Home Assistant (GET /api/users/ha-users)
- Falls back to manual text input when not running as an HA add-on or when supervisor API is unavailable
- Dropdown displays friendly names from person.* entities for easy selection

## [0.6.4-alpha] - 2026-07-01

### Changed
- Colour schemes now control full theme (background, surface, text, borders, accent) not just primary highlight
- Dark mode uses pure black (#000000) background; light mode uses pure white (#ffffff)
- All primary colours adjusted to meet WCAG 2.1 AA contrast ratio (4.5:1 for white button text)
- Colour schemes have proper dark mode variants with scheme-appropriate tinted surfaces

### Fixed
- User switcher name text always visible (forced dark text on white button background regardless of theme)
- Teal scheme secondary text contrast insufficient — darkened to pass 4.5:1
- All 72 contrast pairings across 6 schemes × 2 modes now verified passing WCAG AA

## [0.6.3-alpha] - 2026-07-01

### Added
- Preset colour schemes: 6 accent palettes (Blue, Green, Purple, Orange, Teal, Rose) selectable in Settings > Theme
- Colour schemes persist via localStorage and apply on app startup
- Dark mode variants for each colour scheme (lighter tones for readability)
- Undo button (↩) on each entry in the Task History page to revert completed tasks to pending

### Fixed
- Theme text visibility issues: replaced hardcoded colours with CSS variables across all components
- Added missing dark-mode CSS variable overrides for task card backgrounds, warning boxes, active states
- Added explicit colour properties to action menu buttons for dark mode visibility

## [0.6.2-alpha] - 2026-07-01

### Fixed
- Fixed strict TypeScript errors caught by Docker tsc -b build (noUnusedLocals, noUnusedParameters, noUncheckedIndexedAccess)
- Fixed ingressPath possibly-undefined in DashboardIntegration component
- Fixed unchecked array index access in AddItemForm and Settings
- Fixed unused React import, unused key/userName parameters in test and utility files

## [0.6.1-alpha] - 2026-06-27

### Fixed

- Fixed duplicate vi.mock line in ShoppingList.test.tsx that caused Docker web build to fail

## [0.6.0-alpha] - 2026-06-27

### Added

- Home Assistant Dashboard Integration: REST summary endpoints (/api/summary/tasks, /api/summary/shopping, /api/summary/user/:userId)
- Widget pages for iframe embedding (/api/widgets/tasks, /api/widgets/shopping) with light/dark theme support
- Deep link support: URL query parameters for pre-filtering tasks/shopping lists and opening create forms
- Dashboard Integration settings section with copy-paste YAML snippets for HA sensors, cards, and commands
- Rename lists: inline rename for task lists and shopping lists with validation (max 100 chars, case-insensitive dedup)
- Move items between lists: context menu on task/shopping cards with list picker modal
- Home Assistant user linking: link app profiles to HA usernames in Settings for personalized integrations
- HA notifications: automatic due/overdue task notifications sent to linked HA users (5-minute interval)
- Undo complete/purchase: 5-second snackbar with Undo button after completing tasks or purchasing items
- Uncomplete task endpoint (POST /api/tasks/:id/uncomplete)
- Unpurchase item endpoint (POST /api/shopping/:id/unpurchase)

### Changed

- Task and shopping item cards now use overflow action menu (⋮) with Edit and Move to list options
- Settings page adds Dashboard tab and HA Account section per user
- ReminderService now also triggers HA notification checks

### Database

- Migration 007: Added ha_username column to users table with unique partial index

## [0.5.8-alpha] - 2026-06-26

### Fixed

- Fix TS2739 build error: added EnhancedRecurrencePattern and AnyRecurrencePattern types to frontend
- UpdateTaskInput and CreateTaskInput now accept both legacy and enhanced recurrence patterns

## [0.5.7-alpha] - 2026-06-26

### Added

- Task form: due date is now optional (backlog tasks without a due date)
- Task form: enhanced recurrence patterns — every N days, every N weeks, every specific day, every Nth weekday
- Shopping add item: inline category creation with "+ Add new category..." option
- Warning text shown when recurring task has no due date

### Changed

- Task form: "Assign To" and "Due Date" labels no longer show asterisk (both are optional)
- Settings tabs: wrap to multiple lines instead of scrollbar overflow
- Settings tab padding reduced for better fit on narrow screens

## [0.5.6-alpha] - 2026-06-26

### Removed

- VitePWA service worker completely removed — was causing stale content via HA ingress iframe caching
- No more offline caching (unnecessary for local network HA addon)

### Fixed

- Nginx: aggressive no-cache headers on all non-asset responses to prevent ingress caching

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
