#!/bin/bash
set -e

# Database seed script
# This script is run by the postgres container on first start (after schema.sql)
# It seeds initial data: users, task templates, and item templates

echo "Seeding household_app database..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Seed default users
    INSERT INTO users (name) VALUES ('Alex') ON CONFLICT (name) DO NOTHING;
    INSERT INTO users (name) VALUES ('Becky') ON CONFLICT (name) DO NOTHING;
    INSERT INTO users (name) VALUES ('Sam') ON CONFLICT (name) DO NOTHING;

    -- Seed task templates
    INSERT INTO task_templates (title, description, is_prepopulated) VALUES
        ('Vacuum Living Room', 'Vacuum the living room and hallway', true),
        ('Do the Dishes', 'Wash and put away all dishes', true),
        ('Laundry', 'Wash, dry, and fold laundry', true),
        ('Take Out Trash', 'Take out trash and recycling bins', true),
        ('Mow the Lawn', 'Mow front and back yard', true),
        ('Clean Bathrooms', 'Clean and sanitize all bathrooms', true);

    -- Seed item templates
    INSERT INTO item_templates (name, category, is_prepopulated) VALUES
        ('Milk', 'dairy', true),
        ('Bread', 'bakery', true),
        ('Eggs', 'dairy', true),
        ('Apples', 'produce', true),
        ('Chicken', 'meat', true),
        ('Cheese', 'dairy', true),
        ('Butter', 'dairy', true);
EOSQL

echo "Database seeding completed successfully!"
