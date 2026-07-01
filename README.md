# Household Management App

A Home Assistant add-on for coordinating household chores and shopping lists among household members. Runs self-contained on your HA instance with real-time sync via WebSocket.

**Current version: 0.6.0-alpha**

## Features

- **Task management** — create, assign, complete, and recur tasks across multiple lists
- **Shopping lists** — categorized items with purchase tracking across multiple lists
- **Multiple lists** — separate task lists and shopping lists with rename and move-between support
- **Enhanced recurrence** — every N days, every N weeks, specific weekdays, Nth weekday of month
- **Backlog tasks** — tasks without due dates for unscheduled work
- **Home Assistant Dashboard Integration** — REST summary endpoints and widget pages for iframe embedding
- **Deep links** — URL query parameters for pre-filtering and opening create forms
- **HA user linking** — link app profiles to HA usernames for personalized integrations
- **HA notifications** — automatic due/overdue task notifications to linked HA users
- **Undo actions** — 5-second snackbar with Undo after completing tasks or purchasing items
- **Real-time sync** — WebSocket (Socket.io) for instant updates across all connected clients
- **Light/dark mode** — theme support including widget pages
- **Backup & restore** — full database export/import via admin API
- **Template system** — pre-populated task and item templates with autocomplete search

## Project Structure

```
Home-Tool/
├── backend/                    # Development backend (Node.js + Express + TypeScript)
├── web/                        # Development frontend (React + TypeScript + Vite)
├── household-management/       # HA add-on Docker build context
│   ├── backend-src/            # Backend source (synced copy for Docker build)
│   ├── web-src/                # Frontend source (synced copy for Docker build)
│   ├── config.yaml             # HA add-on configuration
│   ├── Dockerfile              # Multi-stage Docker build
│   ├── CHANGELOG.md            # Version history
│   └── ...
└── .kiro/                      # Spec files and steering rules
```

## Development Setup

### Prerequisites

- Node.js v18+
- PostgreSQL 14+
- npm

### Database Configuration

- **Database Name**: household_app
- **Database User**: household
- **Database Password**: household123 (change in production!)
- **Connection String**: `postgresql://household:household123@localhost:5432/household_app`

### Getting Started

#### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

#### 2. Web Frontend

```bash
cd web
npm install
npm run dev
```

### PostgreSQL Service (WSL)

```bash
sudo service postgresql start
sudo service postgresql status
```

## API Endpoints

### Core Resources
- `GET/POST /api/users` — user management
- `GET/POST/PUT/DELETE /api/tasks` — task CRUD
- `GET/POST/PUT/DELETE /api/shopping` — shopping item CRUD
- `GET/POST/PUT/DELETE /api/task-lists` — task list management
- `GET/POST/PUT/DELETE /api/shopping-lists` — shopping list management
- `GET/POST /api/categories` — category management

### Task Actions
- `POST /api/tasks/:id/complete` — complete a task
- `POST /api/tasks/:id/uncomplete` — undo task completion
- `PUT /api/tasks/:id/move` — move task to another list

### Shopping Actions
- `POST /api/shopping/:id/purchase` — mark item purchased
- `POST /api/shopping/:id/unpurchase` — undo purchase
- `PUT /api/shopping/:id/move` — move item to another list

### Dashboard Integration (Home Assistant)
- `GET /api/summary/tasks` — task summary for HA sensors
- `GET /api/summary/shopping` — shopping summary for HA sensors
- `GET /api/summary/user/:userId` — per-user task summary
- `GET /api/widgets/tasks` — embeddable task widget page
- `GET /api/widgets/shopping` — embeddable shopping widget page

### Admin
- `POST /api/admin/reset` — selective data reset
- `POST /api/admin/factory-reset` — full factory reset
- `GET /api/admin/backup` — export database as JSON
- `POST /api/admin/restore` — import backup JSON
- `GET/PUT /api/admin/config` — configuration management

### Health
- `GET /health` — app health check
- `GET /health/db` — database connectivity check

## Technology Stack

**Backend:**
- Node.js with Express 5
- PostgreSQL database
- WebSocket (Socket.io) for real-time sync
- TypeScript

**Frontend:**
- React 18 with TypeScript
- Vite build tool
- Axios for API calls
- Socket.io client for real-time updates

**Deployment:**
- Docker multi-stage build
- Nginx reverse proxy with HA ingress support
- Home Assistant add-on (amd64, aarch64)

## Changelog

See `household-management/CHANGELOG.md` for detailed version history.
