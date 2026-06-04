#!/bin/bash
set -e

# Database migration script
# Applies schema.sql to the database
# Usage: ./scripts/migrate.sh
# Or with custom env: DB_HOST=localhost DB_PORT=5432 ./scripts/migrate.sh

# Load environment variables from .env if present
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-household_app}"
DB_USER="${DB_USER:-household}"
DB_PASSWORD="${DB_PASSWORD:-password}"

echo "Running database migration..."
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f backend/src/db/schema.sql

echo "Migration completed successfully!"
