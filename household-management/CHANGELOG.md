# Changelog

All notable changes to the Household Management add-on will be documented in this file.

## [1.2.1] - 2026-08-03

### Added
- "📌 Set as default" button on Tasks and Shopping pages to save current view as default with one tap

## [1.2.0] - 2026-08-03

### Added
- Per-page default list preferences: separate settings for Tasks and Shopping pages
- Default task filter preference: choose "My Tasks" or "All Tasks" as default view
- Settings page now has three dropdowns: Default Task List, Default Task Filter, Default Shopping List

### Changed
- Removed old single "default_list_id" app-level navigation (replaced by per-page preferences)
- TaskDashboard now reads user's saved default_task_list_id and default_task_filter on mount
- ShoppingList now reads user's saved default_shopping_list_id on mount

## [1.1.9] - 2026-08-03

### Fixed
- Markdown card snippets now use `content: |` (literal block) for proper line break rendering
- Overdue tasks card uses timestamp comparison (`dueDate | as_timestamp < now().timestamp()`) instead of non-existent `isOverdue` field
- Overdue tasks card uses `namespace()` for loop variable accumulation (required by HA's Jinja2)
- All markdown cards include null guards for sensor attributes (_Waiting for data..._ fallback)
- REST sensor snippets use direct port URL (`http://HOST:8023`) not ingress URLs
- HA_INTEGRATION.md documentation corrected to match production-tested card configurations

## [1.1.8] - 2026-08-03

### Improved
- Dashboard Integration page completely overhauled with expanded snippet library

### Added
- Overdue-only task sensor and markdown card
- Per-user markdown card showing personal task summary
- Button cards for My Tasks, Shopping List, and Create Task deep links
- Full configuration.yaml example combining all sensors and commands
- Host/Port input for button card URL customization
- HA_INTEGRATION.md standalone documentation with API reference, examples, deep link table, and troubleshooting

### Fixed
- Button cards now use action "url" instead of broken "navigate" for non-HA paths
- Deep links use HashRouter format (/#/path) for proper routing

## [1.1.7] - 2026-08-03

### Fixed
- Changing a shopping item's category to "Uncategorized" now saves correctly (was rejected by category validation)

## [1.1.6] - 2026-08-03

### Added
- Undo button on shopping history tab to revert purchased items back to the shopping list

### Fixed
- HA exit button now works from inside cross-origin iframes (webpage dashboard) by detecting ancestor origin

## [1.1.5] - 2026-08-03

### Improved
- History page now has Tasks/Shopping tabs instead of appending purchases at the bottom
- Shopping tab shows purchased items with category, purchaser, and date

## [1.1.4] - 2026-08-03

### Fixed
- HA exit button now uses window.top to break out of iframe nesting and navigate to HA dashboard

## [1.1.3] - 2026-08-03

### Fixed
- Task card action menu (Edit/Move) was hidden behind adjacent cards due to overflow:hidden on wrapper
- "Exit to HA" button now shows when app is embedded in any iframe (not just ingress path)

### Improved
- Task rotation UI has helper text explaining what rotation does

### Changed
- Port 8023 now exposed to host network for non-admin user iframe access

## [1.1.2] - 2026-08-03

### Fixed
- API base URL was absolute ('/api') which bypassed HA ingress proxy — now detected at runtime relative to page path
- Removed auth_api and webui from config.yaml for proper ingress panel routing

## [1.1.1] - 2026-08-03

### Fixed
- Removed `auth_api` and `webui` from config.yaml to fix HA sidebar panel showing onboarding screen instead of the app when accessed via ingress

## [1.1.0] - 2025-07-25

### Added
- Activity log: record task history clears and shopping resets
- Activity log: record category and template create/update/delete events
- Activity log: record task and shopping item moves between lists
- Home Assistant sidebar registration with auto-login via X-Ingress-User header
- Task rotation: recurring tasks automatically rotate through selected users (round-robin)
- Inline category creation from shopping item add/edit form
- "Uncategorized" option for shopping items (no category required)
- Client-side search filtering on task and shopping list pages (≥2 chars, case-insensitive)
- Default list preference per user (saved in settings, applied on app load)
- "Exit to Home Assistant" button in navigation bar (visible inside HA ingress)
- Expandable detail panels on task/item title click (description, due date, assignee, etc.)

### Fixed
- Bug: unable to remove due date from existing tasks (clear button added)
- Bug: recurrence interval input resets value when selecting all and typing (local string state fix)

### Changed
- New tasks default to no due date (previously pre-selected today's date)
- Tasks without due dates sort after all dated tasks in due-date sort order

## 1.0.1
- Added global 'Exit' navigation link to seamlessly drop out back to the main Home Assistant panel.
- Enhanced Home button state-reset routing behavior.

## [1.0.0] - 2026-07-08

### 🎉 First Stable Release

Household Management is now feature-complete and stable for daily household use.

### Features (since 0.8.0)
- Notification timing: global default is now 0 hours (notify when due)
- Zero lead hours fires 'due' notification on the same calendar day, 'overdue' after
- Per-task notification lead hours accepts 0 (notify at due time)
- Activity log tracking task and shopping item CRUD events (create, edit, delete)
- Activity tab displays all event types with emoji icons and human-readable labels
- Comprehensive property-based test suite (10 properties, 92 test assertions)

### Fixed
- NotificationService and ReminderService accept 0 as valid lead hours
- Invalid/negative lead hours fall back to 0 instead of 24
- Settings API accepts 0 as valid notification_lead_hours
- Edit task form time off by 1 hour (UTC→local timezone conversion)
- Activity log entries show correct user for edits and deletes

### Changed
- Dockerfile uses build.yaml + LABEL metadata (HA add-on best practice, base image 3.23)

## [0.9.3-alpha] - 2026-07-08

### Fixed
- Activity log entries for task edit/delete now show correct user (falls back to task creator)
- Activity log entries for shopping edit/remove now show correct user (falls back to item adder)

## [0.9.2-alpha] - 2026-07-08

### Fixed
- Per-task notification lead hours input now accepts 0 (notify when due)
- Settings API validation accepts 0 as valid notification_lead_hours value
- Default notification lead hours set to 0 when checkbox is enabled
- Edit task form no longer shows time 1 hour behind (UTC→local timezone fix)

### Changed
- Dockerfile migrated to use build.yaml pattern matching official HA add-ons (base image 3.23)
- Added LABEL metadata to Dockerfile for HA add-on identification

## [0.9.1-alpha] - 2026-07-08

### Fixed
- Global notification lead time default changed from 24 to 0 hours (notify when due)
- NotificationService and ReminderService now accept 0 as a valid lead hours value
- Zero lead hours timing logic: fires 'due' on same calendar day, 'overdue' after
- Invalid/negative lead hours values now fall back to 0 instead of 24

### Added
- Activity log table (`activity_log`) tracking task and shopping item CRUD events
- Task create/edit/delete events logged to activity_log
- Shopping item add/edit/remove events logged to activity_log
- Activity route now queries activity_log alongside task_history and shopping purchases
- Frontend ActivityLog renders 6 new event types with emojis and labels
- 10 property-based tests validating notification timing and activity response invariants

## [0.9.0-alpha] - 2026-07-07

### Added
- Centralized Logger module (`backend/src/logger.ts`) with level-based filtering (error/warn/info/debug)
- LOG_LEVEL environment variable support — read once at startup, defaults to "info"
- `log_level` option in HA add-on Configuration UI (error|warn|info|debug)
- ISO-8601 timestamped log output with level labels (e.g. `2024-01-15T09:30:45.123Z [INFO] ...`)
- Error-level messages route to stderr, all others to stdout
- Parameter truncation for DB query logs (strings > 200 chars truncated with …)
- 9 property-based tests validating logger correctness (14 test cases total)

### Changed
- DB query logging moved from `console.log` (always on) to `logger.debug` (suppressed at default info level)
- Failed DB queries logged at `logger.error` with SQL text, error message, and duration
- Request logging middleware uses `logger.info` instead of `console.log`
- Server startup, shutdown, and pool error events use structured logger calls
- Production log volume significantly reduced — routine DB queries no longer emitted at default level

## [0.8.0-alpha] - 2026-07-06

### Changed
- Seed data expanded: task templates now include all 15 household chores from migration 004 plus 10 pet care tasks (dog + cat)
- Seed data expanded: item templates now include all 64 UK supermarket items from migration 004 plus 10 pet items in "pet" category
- Users array emptied in source — user accounts are now created at install time, not baked into the repository
- Removed Americanisms from seed data (e.g. "Take Out Trash" → "Take Out Bins", "yard" → "garden")

### Added
- Pet task templates: Walk the Dog, Feed the Dog, Brush the Dog, Dog Flea Treatment, Dog Worming, Feed the Cat, Clean Litter Tray, Cat Flea Treatment, Cat Worming, Book Vet Appointment
- Pet shopping item templates: Dog Food, Dog Treats, Poo Bags, Dog Chews, Cat Food, Cat Treats, Cat Litter, Litter Liners, Flea Treatment, Worming Tablets
- Property-based tests for seed data correctness (7 properties validated)

## [0.7.11-alpha] - 2026-07-06

### Added
- Activity tab in Settings: shows last 30 days of task completions + shopping purchases with who did what and when
- GET /api/activity?days=30 endpoint (combined task + shopping activity feed)
- DELETE /api/activity endpoint (clears task history)
- "Clear Task History" button in Activity tab

### Fixed
- CRITICAL: Calendar icon invisible — `background:` shorthand in form input CSS was resetting `background-image` to none. Changed to `background-color:` in both light and dark mode rules.

### Changed
- Shopping item delete moved from ⋮ menu into the EditShoppingItemForm (matching task edit pattern)
- ShoppingItemCard ⋮ menu now only has Edit and Move to list

## [0.7.10-alpha] - 2026-07-06

### Fixed
- Editing task recurrence now saves correctly — PUT route extracts recurrencePattern fields (type, interval, dayOfWeek, ordinalWeek) into DB columns before passing to updateTask
- Date picker icon: replaced filter-based approach with inline SVG background-image (white stroke in dark mode, gray in light mode) — the native picker indicator is now invisible but the SVG calendar icon is always visible
- Shopping item ⋮ menu clipped by category container — removed overflow:hidden from .category-group so dropdown renders outside the card boundary

### Changed
- Date input uses appearance: none with custom SVG calendar icon for consistent cross-browser/webview rendering

## [0.7.9-alpha] - 2026-07-06

### Fixed
- CRITICAL: Recurring task interval was always reading as 1 — getEnhancedPatternFromTask now reads task.recurrenceInterval (raw DB value) instead of task.recurrencePattern?.interval (which is undefined for enhanced-only tasks)
- Edit mode now correctly shows stored recurrence pattern (reads recurrenceType + recurrenceInterval from API response when legacy recurrencePattern is absent)
- Added recurrenceInterval field to Task model interface and taskFromRow mapper
- Added recurrenceType and recurrenceInterval to frontend Task type

## [0.7.8-alpha] - 2026-07-06

### Added
- Shopping item delete option in ⋮ overflow menu
- Recent Purchases section in History page (shows who purchased each item)
- GET /api/shopping/purchases endpoint for recent purchase history
- Task title autocomplete now includes template names via UNION query

### Fixed
- Shopping item ⋮ menu: Edit option now visible (menu renders when onEdit OR onDelete provided)
- Dark mode calendar picker icon: boosted filter to invert(1) brightness(2) for visibility
- Migration 009: task_history.assigned_to now nullable (fixes "Anyone" task completion)

## [0.7.7-alpha] - 2026-07-06

### Fixed
- CRITICAL: task_history.assigned_to was NOT NULL — completing "Anyone" tasks crashed because NULL couldn't be inserted. Migration 009 drops the constraint.
- This was the root cause of: tasks disappearing on completion, no history entry, no recurring spawn for "Anyone" tasks

### Changed
- Default recurring checkbox is now unchecked (was incorrectly defaulting to checked)
- Recurrence pattern still defaults to "every 1 day" when recurring IS checked

### Database
- Migration 009: ALTER TABLE task_history ALTER COLUMN assigned_to DROP NOT NULL

## [0.7.6-alpha] - 2026-07-06

### Fixed
- Recurring task spawn wrapped in try/catch — spawn failures no longer crash the completion API (task completes successfully even if spawn fails)
- Task completion now refreshes the list after success to show the newly spawned recurring task
- Frontend handleComplete wrapped in try/catch with refreshTasks fallback on error
- Fixed duplicate closing brace in TaskDashboard handleComplete

## [0.7.5-alpha] - 2026-07-06

### Fixed
- Backend strict null check: legacy spawn branch changed from `else` to `else if (task.recurrencePattern)` to narrow type
- Backend strict null check: wrapped dbCreateTask call with guard for possibly-uninitialized nextDbInput

## [0.7.4-alpha] - 2026-07-06

### Fixed
- Recurring task spawn: guard now checks both legacy (recurrencePattern) and enhanced (recurrenceType) paths — tasks created via the new RecurrenceSelector now correctly spawn next occurrences
- Recurring task spawn: fixed null reference when accessing recurrencePattern.frequency on enhanced-only tasks (added optional chaining)
- Date picker: added color-scheme: dark for dark mode so calendar icon and popup render correctly
- TaskForm: API errors now display inline (was silently swallowing errors)
- Task completion: verified optimistic removal from list works correctly

### Added
- "Notify me before due date" checkbox in TaskForm (hides hours input when unchecked)

## [0.7.3-alpha] - 2026-07-06

### Fixed
- Date picker now shows native calendar popup in HA ingress iframe (CSS appearance fix)
- Shopping item autocomplete now includes item templates (works on fresh lists)

## [0.7.2-alpha] - 2026-07-06

### Fixed
- Backend build: added listId to Task interface and list_id to TaskRow + taskFromRow mapper
- Backend build: added list_id: null to Task.test.ts and SummaryService.property.test.ts mocks
- Backend build: fixed settingsRoutes req.params.key type cast (string | string[] → as string)
- Docker cache bust: modified backend-package.json to force layer rebuild

## [0.7.1-alpha] - 2026-07-06

### Fixed
- Frontend build: added non-null assertion to TaskAutocomplete suggestions[highlightIndex]
- Docker cache bust: modified web-vite.config.ts to force layer rebuild

## [0.7.0-alpha] - 2026-07-06

### Added
- Recurring task spawn fix: completing a recurring task now creates the next occurrence with correct listId and all fields preserved
- Monthly and yearly recurrence patterns (every_n_months, every_n_years) added to recurrence engine
- Native date picker replaces free-text date input in TaskForm (mobile-friendly)
- RecurrenceSelector component: frequency dropdown (days/weeks/months/years) + interval input
- Configurable notification lead time: global default (24h) + per-task override field
- App settings API: GET/PUT /api/settings/:key for managing global configuration
- Task title autocomplete: type 2+ characters to see previously-used titles (replaces template quick-add)
- Shopping item autocomplete: type 1+ characters to see name-category pairs from history
- Category auto-fill: selecting an existing item from autocomplete pre-fills the category
- Same item name allowed in different categories (e.g., "tomatoes" in canned and produce)
- Database migration 008: notification_lead_hours column + app_settings table

### Changed
- TaskForm defaults assignee to "Anyone" instead of current user
- TaskForm template quick-add section removed (replaced by title autocomplete)
- ReminderService and NotificationService now use configurable lead time window
- AddItemForm uses ItemAutocomplete component for name input

### Fixed
- Recurring tasks now correctly spawn next occurrence instead of just completing
- listId preserved when recurring task spawns (was lost, causing tasks to disappear from lists)

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
