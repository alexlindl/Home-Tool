# Database Module

This module handles all database connections and operations for the Household Management App backend.

## Files

- **schema.sql** - PostgreSQL database schema with all tables and indexes
- **connection.ts** - Database connection pool configuration and query helpers
- **seed.ts** - Database initialization and seed data script
- **test-connection.ts** - Connection test script
- **index.ts** - Module exports

## Database Schema

The database includes the following tables:

### Core Tables
- **users** - Household members (Alex, Becky, Sam)
- **tasks** - Task assignments with due dates and recurrence
- **task_templates** - Pre-populated and custom task templates
- **task_history** - Completed task records
- **shopping_items** - Shopping list items with categories
- **item_templates** - Pre-populated and custom shopping item templates

### Indexes
Performance indexes are created on frequently queried columns:
- `tasks.assigned_to`, `tasks.due_date`, `tasks.status`
- `shopping_items.category`, `shopping_items.is_purchased`
- `task_history.completed_at`

## Usage

### Initialize Database

Run this once to create tables and seed initial data:

```bash
npm run db:init
```

This will:
1. Create all database tables
2. Add three users: Alex, Becky, Sam
3. Add 6 pre-populated task templates
4. Add 7 pre-populated item templates

### Test Connection

Verify database connectivity:

```bash
npm run db:test
```

### Using in Code

```typescript
import { query, getClient, testConnection } from './db';

// Simple query
const result = await query('SELECT * FROM users');

// Query with parameters
const user = await query('SELECT * FROM users WHERE name = $1', ['Alex']);

// Transaction
const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO tasks ...');
  await client.query('INSERT INTO task_history ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Connection Pool Configuration

The connection pool is configured via environment variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=household_app
DB_USER=household
DB_PASSWORD=household123
DB_POOL_MIN=2
DB_POOL_MAX=10
```

## Seed Data

### Users
- Alex
- Becky
- Sam

### Task Templates
- Vacuum Living Room
- Do the Dishes
- Laundry
- Take Out Trash
- Mow the Lawn
- Clean Bathrooms

### Item Templates
- Milk (dairy)
- Bread (bakery)
- Eggs (dairy)
- Apples (produce)
- Chicken (meat)
- Cheese (dairy)
- Butter (dairy)

## Requirements Validated

This module validates the following requirements:

- **Requirement 12.3** - Backend stores all Task and Shopping_List data
- **Requirement 1.3** - Support three Users: Alex, Becky, and Sam
- **Requirement 3.1** - Pre-populated Task_Templates for common chores
- **Requirement 8.1** - Pre-populated Item_Templates for common items
