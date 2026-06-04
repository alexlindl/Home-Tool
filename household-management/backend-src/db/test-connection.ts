import { testConnection, query, closePool } from './connection';

const testDatabaseConnection = async () => {
  console.log('Testing database connection...\n');

  try {
    // Test basic connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    console.log('\n✓ Database connection successful!\n');

    // Test querying users
    console.log('Querying users...');
    const usersResult = await query('SELECT * FROM users ORDER BY name');
    console.log(`Found ${usersResult.rowCount} users:`);
    usersResult.rows.forEach((user) => {
      console.log(`  - ${user.name} (ID: ${user.id})`);
    });

    console.log('\nQuerying task templates...');
    const templatesResult = await query(
      'SELECT * FROM task_templates WHERE is_prepopulated = true ORDER BY title'
    );
    console.log(`Found ${templatesResult.rowCount} task templates:`);
    templatesResult.rows.forEach((template) => {
      console.log(`  - ${template.title}`);
    });

    console.log('\nQuerying item templates...');
    const itemsResult = await query(
      'SELECT * FROM item_templates WHERE is_prepopulated = true ORDER BY name'
    );
    console.log(`Found ${itemsResult.rowCount} item templates:`);
    itemsResult.rows.forEach((item) => {
      console.log(`  - ${item.name} (${item.category})`);
    });

    console.log('\n✓ All database queries successful!');
  } catch (error) {
    console.error('\n✗ Database test failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
};

// Run test if executed directly
if (require.main === module) {
  testDatabaseConnection();
}

export { testDatabaseConnection };
