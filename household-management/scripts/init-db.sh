#!/bin/bash
set -e

# Database seed script
# This script is run on container start (after schema.sql)
# It seeds initial data: users, task templates, and item templates
# Uses WHERE NOT EXISTS to be idempotent (safe to run multiple times)

echo "Seeding household_app database..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Seed default users
    INSERT INTO users (name) VALUES ('Alex') ON CONFLICT (name) DO NOTHING;
    INSERT INTO users (name) VALUES ('Becky') ON CONFLICT (name) DO NOTHING;
    INSERT INTO users (name) VALUES ('Sam') ON CONFLICT (name) DO NOTHING;

    -- Seed task templates (idempotent)
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

    -- Seed item templates (idempotent)
    INSERT INTO item_templates (name, category, is_prepopulated)
        SELECT 'Milk', 'dairy', true
        WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Milk' AND is_prepopulated = true);
    INSERT INTO item_templates (name, category, is_prepopulated)
        SELECT 'Bread', 'bakery', true
        WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Bread' AND is_prepopulated = true);
    INSERT INTO item_templates (name, category, is_prepopulated)
        SELECT 'Eggs', 'dairy', true
        WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Eggs' AND is_prepopulated = true);
    INSERT INTO item_templates (name, category, is_prepopulated)
        SELECT 'Apples', 'produce', true
        WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Apples' AND is_prepopulated = true);
    INSERT INTO item_templates (name, category, is_prepopulated)
        SELECT 'Chicken', 'meat', true
        WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Chicken' AND is_prepopulated = true);
    INSERT INTO item_templates (name, category, is_prepopulated)
        SELECT 'Cheese', 'dairy', true
        WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Cheese' AND is_prepopulated = true);
    INSERT INTO item_templates (name, category, is_prepopulated)
        SELECT 'Butter', 'dairy', true
        WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Butter' AND is_prepopulated = true);
EOSQL

echo "Database seeding completed successfully!"
