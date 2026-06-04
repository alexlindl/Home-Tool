# Household Management Backend

Backend API for the Household Management App - a multi-user system for coordinating household chores and shopping.

## Technology Stack

- **Runtime**: Node.js v18 LTS
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Real-time**: Socket.io
- **Code Quality**: ESLint + Prettier

## Project Structure

```
backend/
├── src/
│   ├── db/          # Database connection, schema, and seed scripts
│   ├── models/      # TypeScript interfaces and data models
│   ├── routes/      # API endpoint routes
│   ├── services/    # Business logic and service classes
│   ├── utils/       # Helper functions and utilities
│   └── index.ts     # Application entry point
├── dist/            # Compiled JavaScript output
├── .env.example     # Environment variable template
└── package.json     # Project dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js v18 LTS or higher
- PostgreSQL 12 or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Initialize the database:
```bash
npm run db:init
```

This will create all database tables and seed initial data (users, task templates, item templates).

4. Build the project:
```bash
npm run build
```

### Development

Run the development server with hot reload:
```bash
npm run dev
```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the production server
- `npm run dev` - Run development server with hot reload
- `npm run lint` - Check code quality with ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run db:init` - Initialize database schema and seed data
- `npm run db:seed` - Re-seed database with initial data
- `npm run db:test` - Test database connection

## Configuration

The following environment variables can be configured in `.env`:

### Server Configuration
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production)

### Database Configuration
- `DATABASE_URL` - PostgreSQL connection string
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: household_app)
- `DB_USER` - Database user (default: household)
- `DB_PASSWORD` - Database password
- `DB_POOL_MIN` - Minimum pool connections (default: 2)
- `DB_POOL_MAX` - Maximum pool connections (default: 10)

### WebSocket Configuration
- `WS_PORT` - WebSocket port (default: 3001)

### CORS Configuration
- `CORS_ORIGIN` - Allowed origins for CORS

See `.env.example` for a complete list of configuration options.

## API Documentation

API endpoints will be documented as they are implemented.

## Database

The backend uses PostgreSQL with connection pooling for efficient database operations. The database schema includes:

- **users** - Household members (Alex, Becky, Sam)
- **tasks** - Task assignments with due dates and recurrence
- **task_templates** - Pre-populated and custom task templates
- **task_history** - Completed task records
- **shopping_items** - Shopping list items with categories
- **item_templates** - Pre-populated and custom shopping item templates

For detailed database documentation, see [src/db/README.md](src/db/README.md).

### Initial Seed Data

The database is seeded with:
- 3 users: Alex, Becky, Sam
- 6 task templates: Vacuum Living Room, Do the Dishes, Laundry, Take Out Trash, Mow the Lawn, Clean Bathrooms
- 7 item templates: Milk, Bread, Eggs, Apples, Chicken, Cheese, Butter

## License

ISC
