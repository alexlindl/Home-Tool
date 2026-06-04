import { query, testConnection, closePool } from './connection';
import fs from 'fs';
import path from 'path';

// Seed data for users
const seedUsers = async () => {
  console.log('Seeding users...');
  
  const users = [
    { name: 'Alex' },
    { name: 'Becky' },
    { name: 'Sam' },
  ];

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
    { title: 'Vacuum Living Room', description: 'Vacuum the living room and hallway' },
    { title: 'Do the Dishes', description: 'Wash and put away all dishes' },
    { title: 'Laundry', description: 'Wash, dry, and fold laundry' },
    { title: 'Take Out Trash', description: 'Take out trash and recycling bins' },
    { title: 'Mow the Lawn', description: 'Mow front and back yard' },
    { title: 'Clean Bathrooms', description: 'Clean and sanitize all bathrooms' },
  ];

  for (const template of templates) {
    try {
      await query(
        'INSERT INTO task_templates (title, description, is_prepopulated) VALUES ($1, $2, $3)',
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
    { name: 'Milk', category: 'dairy' },
    { name: 'Bread', category: 'bakery' },
    { name: 'Eggs', category: 'dairy' },
    { name: 'Apples', category: 'produce' },
    { name: 'Chicken', category: 'meat' },
    { name: 'Cheese', category: 'dairy' },
    { name: 'Butter', category: 'dairy' },
  ];

  for (const template of templates) {
    try {
      await query(
        'INSERT INTO item_templates (name, category, is_prepopulated) VALUES ($1, $2, $3)',
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
