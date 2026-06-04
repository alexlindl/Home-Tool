import { query, testConnection, closePool } from './connection';
import fs from 'fs';
import path from 'path';

/**
 * Database migration script
 * Applies schema.sql to create/update all tables and indexes.
 * Also applies any migration files in the migrations/ directory.
 * Safe to run multiple times due to IF NOT EXISTS clauses.
 */
const migrate = async () => {
  console.log('Starting database migration...\n');

  try {
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    console.log('');

    // Read and apply schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying database schema...');
    await query(schema);
    console.log('  ✓ Schema applied successfully');

    // Apply migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const file of migrationFiles) {
        console.log(`Applying migration: ${file}...`);
        const migrationPath = path.join(migrationsDir, file);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        await query(migrationSql);
        console.log(`  ✓ Migration "${file}" applied`);
      }
    }

    console.log('\n✓ Database migration completed successfully!');
  } catch (error) {
    console.error('✗ Database migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
};

// Run migration if executed directly
if (require.main === module) {
  migrate();
}

export { migrate };
