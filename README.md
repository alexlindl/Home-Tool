# Household Management App

A cross-platform household management application for coordinating chores and shopping lists among household members.

## Project Structure

```
household-management-app/
├── backend/          # Node.js + Express backend with PostgreSQL
├── mobile/           # Flutter mobile app (Android & iOS)
├── web/              # React web application
└── .kiro/            # Kiro spec files
```

## Development Environment

### Prerequisites

- Windows 11 with WSL2
- Ubuntu 22.04 LTS (in WSL)
- Node.js v18 LTS
- PostgreSQL 14
- Flutter SDK 3.16.0

### Installation Status

✅ WSL2 with Ubuntu 22.04 LTS - Installed
✅ Node.js v18.20.8 - Installed
✅ npm v10.8.2 - Installed
✅ PostgreSQL 14.20 - Installed and configured
✅ Flutter 3.16.0 - Installed
✅ Git 2.34.1 - Installed

### Database Configuration

- **Database Name**: household_app
- **Database User**: household
- **Database Password**: household123 (change in production!)
- **Connection String**: postgresql://household:household123@localhost:5432/household_app

### Getting Started

#### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

#### 2. Mobile App Setup

```bash
cd mobile
flutter pub get
flutter run
```

#### 3. Web App Setup

```bash
cd web
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Flutter Path Configuration

Flutter is installed at `~/flutter/bin`. To use Flutter commands, either:

1. **Use the full path**:
   ```bash
   ~/flutter/bin/flutter doctor
   ```

2. **Or reload your shell** (the PATH was added to ~/.bashrc):
   ```bash
   source ~/.bashrc
   flutter doctor
   ```

### PostgreSQL Service

To start PostgreSQL in WSL:
```bash
sudo service postgresql start
```

To check PostgreSQL status:
```bash
sudo service postgresql status
```

### Next Steps

1. ✅ Development environment setup complete
2. ⏭️ Initialize backend project structure (Task 2)
3. ⏭️ Implement User service and API endpoints (Task 3)
4. ⏭️ Continue with remaining tasks from the implementation plan

## Technology Stack

**Backend:**
- Node.js with Express
- PostgreSQL database
- WebSocket (Socket.io) for real-time sync
- TypeScript

**Mobile:**
- Flutter (Android & iOS)
- SQLite for local storage
- Provider for state management

**Web:**
- React with TypeScript
- IndexedDB for local storage
- Redux/Context for state management

## Requirements

See `.kiro/specs/household-management-app/requirements.md` for detailed requirements.

## Design

See `.kiro/specs/household-management-app/design.md` for architecture and design details.

## Implementation Plan

See `.kiro/specs/household-management-app/tasks.md` for the complete task breakdown.
