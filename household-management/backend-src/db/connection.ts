import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database connection configuration
const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'household_app',
  user: process.env.DB_USER || 'household',
  password: process.env.DB_PASSWORD || 'password',
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(poolConfig);

// Handle pool errors - log but don't crash on transient connection issues
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client:', err.message);
  // Don't exit — the pool will automatically reconnect on next query
});

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Query helper function
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

// Get a client from the pool for transactions
export const getClient = async () => {
  return await pool.connect();
};

// Close the pool
export const closePool = async () => {
  await pool.end();
  console.log('Database pool closed');
};

export default pool;
