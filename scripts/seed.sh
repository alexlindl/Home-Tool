#!/bin/bash
set -e

# Database seed script
# Seeds initial data (users, task templates, item templates)
# Usage: ./scripts/seed.sh
# Or with custom env: DB_HOST=localhost DB_PORT=5432 ./scripts/seed.sh

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

echo "Running database seed..."
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<-EOSQL
    -- Seed default users
    INSERT INTO users (name) VALUES ('Alex') ON CONFLICT (name) DO NOTHING;
    INSERT INTO users (name) VALUES ('Becky') ON CONFLICT (name) DO NOTHING;
    INSERT INTO users (name) VALUES ('Sam') ON CONFLICT (name) DO NOTHING;

    -- Seed task templates (avoid duplicates by checking title)
    INSERT INTO task_templates (title, description, is_prepopulated)
    SELECT 'Vacuum Living Room', 'Vacuum the living room and hallway', true
    WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Vacuum Living Room');

    INSERT INTO task_templates (title, description, is_prepopulated)
    SELECT 'Do the Dishes', 'Wash and put away all dishes', true
    WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Do the Dishes');

    INSERT INTO task_templates (title, description, is_prepopulated)
    SELECT 'Laundry', 'Wash, dry, and fold laundry', true
    WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Laundry');

    INSERT INTO task_templates (title, description, is_prepopulated)
    SELECT 'Take Out Trash', 'Take out trash and recycling bins', true
    WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Take Out Trash');

    INSERT INTO task_templates (title, description, is_prepopulated)
    SELECT 'Mow the Lawn', 'Mow front and back yard', true
    WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Mow the Lawn');

    INSERT INTO task_templates (title, description, is_prepopulated)
    SELECT 'Clean Bathrooms', 'Clean and sanitize all bathrooms', true
    WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Clean Bathrooms');

    -- Seed item templates (avoid duplicates by checking name)
    INSERT INTO item_templates (name, category, is_prepopulated)
    SELECT 'Milk', 'dairy', true
    WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Milk');

    INSERT INTO item_templates (name, category, is_prepopulated)
    SELECT 'Bread', 'bakery', true
    WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Bread');

    INSERT INTO item_templates (name, category, is_prepopulated)
    SELECT 'Eggs', 'dairy', true
    WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Eggs');

    INSERT INTO item_templates (name, category, is_prepopulated)
    SELECT 'Apples', 'produce', true
    WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Apples');

    INSERT INTO item_templates (name, category, is_prepopulated)
    SELECT 'Chicken', 'meat', true
    WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Chicken');

    INSERT INTO item_templates (name, category, is_prepopulated)
    SELECT 'Cheese', 'dairy', true
    WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Cheese');

    INSERT INTO item_templates (name, category, is_prepopulated)
    SELECT 'Butter', 'dairy', true
    WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Butter');
EOSQL

echo "Database seed completed successfully!"
