-- Migration 004: Seed default categories, task templates, and shopping item templates
-- Uses WHERE NOT EXISTS to be idempotent (safe to run multiple times)

-- ============================================================================
-- Categories (UK supermarket layout)
-- ============================================================================
INSERT INTO categories (name, is_default) SELECT 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'produce');
INSERT INTO categories (name, is_default) SELECT 'dairy', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'dairy');
INSERT INTO categories (name, is_default) SELECT 'bakery', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'bakery');
INSERT INTO categories (name, is_default) SELECT 'meat', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'meat');
INSERT INTO categories (name, is_default) SELECT 'frozen', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'frozen');
INSERT INTO categories (name, is_default) SELECT 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'pantry');
INSERT INTO categories (name, is_default) SELECT 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'household');
INSERT INTO categories (name, is_default) SELECT 'drinks', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'drinks');
INSERT INTO categories (name, is_default) SELECT 'snacks', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'snacks');
INSERT INTO categories (name, is_default) SELECT 'toiletries', TRUE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'toiletries');
INSERT INTO categories (name, is_default) SELECT 'baby', FALSE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'baby');
INSERT INTO categories (name, is_default) SELECT 'pet', FALSE WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'pet');

-- ============================================================================
-- Task Templates (common household chores)
-- ============================================================================
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Vacuum Living Room', 'Vacuum carpets and rugs in the living room', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Vacuum Living Room');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Vacuum Bedrooms', 'Vacuum all bedroom floors', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Vacuum Bedrooms');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Mop Kitchen Floor', 'Mop and clean the kitchen floor', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Mop Kitchen Floor');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Clean Bathrooms', 'Clean toilet, sink, bath/shower and mirrors', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Clean Bathrooms');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Do the Dishes', 'Wash up or load/unload dishwasher', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Do the Dishes');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Laundry', 'Wash, dry and fold laundry', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Laundry');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Iron Clothes', 'Iron and put away clean clothes', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Iron Clothes');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Take Out Bins', 'Take recycling and general waste out', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Take Out Bins');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Mow the Lawn', 'Mow front and back garden', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Mow the Lawn');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Tidy Up', 'General tidy of shared spaces', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Tidy Up');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Change Bed Sheets', 'Strip and remake beds with fresh linen', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Change Bed Sheets');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Clean Windows', 'Clean interior windows and sills', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Clean Windows');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Dust Surfaces', 'Dust shelves, furniture and ornaments', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Dust Surfaces');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Clean Oven', 'Deep clean the oven', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Clean Oven');
INSERT INTO task_templates (title, description, is_prepopulated) SELECT 'Food Shop', 'Do the weekly food shop', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = 'Food Shop');

-- ============================================================================
-- Shopping Item Templates (common UK supermarket items)
-- ============================================================================

-- Produce
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Bananas', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Bananas');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Apples', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Apples');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Potatoes', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Potatoes');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Onions', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Onions');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Carrots', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Carrots');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Tomatoes', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Tomatoes');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Cucumber', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Cucumber');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Lettuce', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Lettuce');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Mushrooms', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Mushrooms');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Peppers', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Peppers');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Broccoli', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Broccoli');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Garlic', 'produce', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Garlic');

-- Dairy
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Milk', 'dairy', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Milk');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Butter', 'dairy', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Butter');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Cheese', 'dairy', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Cheese');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Eggs', 'dairy', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Eggs');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Yoghurt', 'dairy', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Yoghurt');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Cream', 'dairy', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Cream');

-- Bakery
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Bread', 'bakery', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Bread');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Rolls', 'bakery', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Rolls');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Wraps', 'bakery', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Wraps');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Crumpets', 'bakery', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Crumpets');

-- Meat
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Chicken Breasts', 'meat', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Chicken Breasts');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Mince Beef', 'meat', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Mince Beef');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Bacon', 'meat', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Bacon');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Sausages', 'meat', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Sausages');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Salmon Fillets', 'meat', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Salmon Fillets');

-- Frozen
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Fish Fingers', 'frozen', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Fish Fingers');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Frozen Peas', 'frozen', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Frozen Peas');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Chips', 'frozen', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Chips');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Pizza', 'frozen', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Pizza');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Ice Cream', 'frozen', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Ice Cream');

-- Pantry
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Pasta', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Pasta');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Rice', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Rice');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Tinned Tomatoes', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Tinned Tomatoes');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Baked Beans', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Baked Beans');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Cereal', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Cereal');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Cooking Oil', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Cooking Oil');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Flour', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Flour');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Sugar', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Sugar');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Tea Bags', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Tea Bags');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Coffee', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Coffee');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Salt', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Salt');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Pepper', 'pantry', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Pepper');

-- Drinks
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Orange Juice', 'drinks', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Orange Juice');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Squash', 'drinks', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Squash');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Fizzy Water', 'drinks', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Fizzy Water');

-- Snacks
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Crisps', 'snacks', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Crisps');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Biscuits', 'snacks', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Biscuits');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Chocolate', 'snacks', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Chocolate');

-- Household
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Kitchen Roll', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Kitchen Roll');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Toilet Roll', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Toilet Roll');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Bin Bags', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Bin Bags');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Washing Up Liquid', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Washing Up Liquid');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Laundry Detergent', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Laundry Detergent');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Dishwasher Tablets', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Dishwasher Tablets');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Surface Cleaner', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Surface Cleaner');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Sponges', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Sponges');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Cling Film', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Cling Film');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Foil', 'household', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Foil');

-- Toiletries
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Shampoo', 'toiletries', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Shampoo');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Shower Gel', 'toiletries', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Shower Gel');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Toothpaste', 'toiletries', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Toothpaste');
INSERT INTO item_templates (name, category, is_prepopulated) SELECT 'Deodorant', 'toiletries', TRUE WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = 'Deodorant');
