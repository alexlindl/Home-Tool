import { query, testConnection, closePool } from './connection';
import fs from 'fs';
import path from 'path';

// Seed data for users
const seedUsers = async () => {
  console.log('Seeding users...');

  const users: { name: string }[] = [];

  for (const user of users) {
    try {
      await query(
        'INSERT INTO users (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [user.name]
      );
      console.log(`  ✓ User "${user.name}" created`);
    } catch (error) {
      console.error(`  ✗ Failed to create user "${user.name}":`, error);
    }
  }
};

// Seed data for task templates
const seedTaskTemplates = async () => {
  console.log('Seeding task templates...');

  const templates = [
    // ========================================================================
    // Household chores (15) — matching migration 004
    // ========================================================================
    { title: 'Vacuum Living Room', description: 'Vacuum carpets and rugs in the living room' },
    { title: 'Vacuum Bedrooms', description: 'Vacuum all bedroom floors' },
    { title: 'Mop Kitchen Floor', description: 'Mop and clean the kitchen floor' },
    { title: 'Clean Bathrooms', description: 'Clean toilet, sink, bath/shower and mirrors' },
    { title: 'Do the Dishes', description: 'Wash up or load/unload dishwasher' },
    { title: 'Laundry', description: 'Wash, dry and fold laundry' },
    { title: 'Iron Clothes', description: 'Iron and put away clean clothes' },
    { title: 'Take Out Bins', description: 'Take recycling and general waste out' },
    { title: 'Mow the Lawn', description: 'Mow front and back garden' },
    { title: 'Tidy Up', description: 'General tidy of shared spaces' },
    { title: 'Change Bed Sheets', description: 'Strip and remake beds with fresh linen' },
    { title: 'Clean Windows', description: 'Clean interior windows and sills' },
    { title: 'Dust Surfaces', description: 'Dust shelves, furniture and ornaments' },
    { title: 'Clean Oven', description: 'Deep clean the oven' },
    { title: 'Food Shop', description: 'Do the weekly food shop' },

    // ========================================================================
    // Pet care (10) — dog (5), cat (4), shared (1)
    // ========================================================================
    { title: 'Walk the Dog', description: 'Take the dog for a walk — morning or evening' },
    { title: 'Feed the Dog', description: 'Put out fresh food and water for the dog' },
    { title: 'Brush the Dog', description: 'Brush the dog to remove loose fur and tangles' },
    { title: 'Dog Flea Treatment', description: 'Apply monthly flea treatment to the dog' },
    { title: 'Dog Worming', description: 'Give the dog their worming tablet' },
    { title: 'Feed the Cat', description: 'Put out fresh food and water for the cat' },
    { title: 'Clean Litter Tray', description: 'Scoop and refresh the cat litter tray' },
    { title: 'Cat Flea Treatment', description: 'Apply monthly flea treatment to the cat' },
    { title: 'Cat Worming', description: 'Give the cat their worming tablet' },
    { title: 'Book Vet Appointment', description: 'Book a check-up or vaccination appointment at the vet' },
  ];

  for (const template of templates) {
    try {
      await query(
        `INSERT INTO task_templates (title, description, is_prepopulated)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM task_templates WHERE title = $1)`,
        [template.title, template.description, true]
      );
      console.log(`  ✓ Task template "${template.title}" created`);
    } catch (error) {
      console.error(`  ✗ Failed to create task template "${template.title}":`, error);
    }
  }
};

// Seed data for item templates
const seedItemTemplates = async () => {
  console.log('Seeding item templates...');

  const templates = [
    // ========================================================================
    // Produce (12)
    // ========================================================================
    { name: 'Bananas', category: 'produce' },
    { name: 'Apples', category: 'produce' },
    { name: 'Potatoes', category: 'produce' },
    { name: 'Onions', category: 'produce' },
    { name: 'Carrots', category: 'produce' },
    { name: 'Tomatoes', category: 'produce' },
    { name: 'Cucumber', category: 'produce' },
    { name: 'Lettuce', category: 'produce' },
    { name: 'Mushrooms', category: 'produce' },
    { name: 'Peppers', category: 'produce' },
    { name: 'Broccoli', category: 'produce' },
    { name: 'Garlic', category: 'produce' },

    // ========================================================================
    // Dairy (6)
    // ========================================================================
    { name: 'Milk', category: 'dairy' },
    { name: 'Butter', category: 'dairy' },
    { name: 'Cheese', category: 'dairy' },
    { name: 'Eggs', category: 'dairy' },
    { name: 'Yoghurt', category: 'dairy' },
    { name: 'Cream', category: 'dairy' },

    // ========================================================================
    // Bakery (4)
    // ========================================================================
    { name: 'Bread', category: 'bakery' },
    { name: 'Rolls', category: 'bakery' },
    { name: 'Wraps', category: 'bakery' },
    { name: 'Crumpets', category: 'bakery' },

    // ========================================================================
    // Meat (5)
    // ========================================================================
    { name: 'Chicken Breasts', category: 'meat' },
    { name: 'Mince Beef', category: 'meat' },
    { name: 'Bacon', category: 'meat' },
    { name: 'Sausages', category: 'meat' },
    { name: 'Salmon Fillets', category: 'meat' },

    // ========================================================================
    // Frozen (5)
    // ========================================================================
    { name: 'Fish Fingers', category: 'frozen' },
    { name: 'Frozen Peas', category: 'frozen' },
    { name: 'Chips', category: 'frozen' },
    { name: 'Pizza', category: 'frozen' },
    { name: 'Ice Cream', category: 'frozen' },

    // ========================================================================
    // Pantry (12)
    // ========================================================================
    { name: 'Pasta', category: 'pantry' },
    { name: 'Rice', category: 'pantry' },
    { name: 'Tinned Tomatoes', category: 'pantry' },
    { name: 'Baked Beans', category: 'pantry' },
    { name: 'Cereal', category: 'pantry' },
    { name: 'Cooking Oil', category: 'pantry' },
    { name: 'Flour', category: 'pantry' },
    { name: 'Sugar', category: 'pantry' },
    { name: 'Tea Bags', category: 'pantry' },
    { name: 'Coffee', category: 'pantry' },
    { name: 'Salt', category: 'pantry' },
    { name: 'Pepper', category: 'pantry' },

    // ========================================================================
    // Drinks (3)
    // ========================================================================
    { name: 'Orange Juice', category: 'drinks' },
    { name: 'Squash', category: 'drinks' },
    { name: 'Fizzy Water', category: 'drinks' },

    // ========================================================================
    // Snacks (3)
    // ========================================================================
    { name: 'Crisps', category: 'snacks' },
    { name: 'Biscuits', category: 'snacks' },
    { name: 'Chocolate', category: 'snacks' },

    // ========================================================================
    // Household (10)
    // ========================================================================
    { name: 'Kitchen Roll', category: 'household' },
    { name: 'Toilet Roll', category: 'household' },
    { name: 'Bin Bags', category: 'household' },
    { name: 'Washing Up Liquid', category: 'household' },
    { name: 'Laundry Detergent', category: 'household' },
    { name: 'Dishwasher Tablets', category: 'household' },
    { name: 'Surface Cleaner', category: 'household' },
    { name: 'Sponges', category: 'household' },
    { name: 'Cling Film', category: 'household' },
    { name: 'Foil', category: 'household' },

    // ========================================================================
    // Toiletries (4)
    // ========================================================================
    { name: 'Shampoo', category: 'toiletries' },
    { name: 'Shower Gel', category: 'toiletries' },
    { name: 'Toothpaste', category: 'toiletries' },
    { name: 'Deodorant', category: 'toiletries' },

    // ========================================================================
    // Pet (10) — dog (4), cat (4), shared (2)
    // ========================================================================
    { name: 'Dog Food', category: 'pet' },
    { name: 'Dog Treats', category: 'pet' },
    { name: 'Poo Bags', category: 'pet' },
    { name: 'Dog Chews', category: 'pet' },
    { name: 'Cat Food', category: 'pet' },
    { name: 'Cat Treats', category: 'pet' },
    { name: 'Cat Litter', category: 'pet' },
    { name: 'Litter Liners', category: 'pet' },
    { name: 'Flea Treatment', category: 'pet' },
    { name: 'Worming Tablets', category: 'pet' },
  ];

  for (const template of templates) {
    try {
      await query(
        `INSERT INTO item_templates (name, category, is_prepopulated)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM item_templates WHERE name = $1 AND is_prepopulated = true)`,
        [template.name, template.category, true]
      );
      console.log(`  ✓ Item template "${template.name}" created`);
    } catch (error) {
      console.error(`  ✗ Failed to create item template "${template.name}":`, error);
    }
  }
};

// Initialize database schema
const initializeSchema = async () => {
  console.log('Initializing database schema...');

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await query(schema);
    console.log('  ✓ Database schema initialized');

    // Apply migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const migrationPath = path.join(migrationsDir, file);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        await query(migrationSql);
        console.log(`  ✓ Migration "${file}" applied`);
      }
    }
  } catch (error) {
    console.error('  ✗ Failed to initialize schema:', error);
    throw error;
  }
};

// Main seed function
const seed = async () => {
  console.log('Starting database initialization and seeding...\n');

  try {
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    console.log('');

    // Initialize schema
    await initializeSchema();
    console.log('');

    // Seed data
    await seedUsers();
    console.log('');

    await seedTaskTemplates();
    console.log('');

    await seedItemTemplates();
    console.log('');

    console.log('✓ Database initialization and seeding completed successfully!');
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
};

// Run seed if executed directly
if (require.main === module) {
  seed();
}

export { seed, seedUsers, seedTaskTemplates, seedItemTemplates, initializeSchema };
