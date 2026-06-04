/**
 * User queries tests
 * Tests for user database operations
 */

import { getAllUsers, getUserById, getUserByName } from './userQueries';
import { testConnection, closePool } from './connection';

describe('User Queries', () => {
  beforeAll(async () => {
    // Ensure database connection is working
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }
  });

  afterAll(async () => {
    // Close database connection pool
    await closePool();
  });

  describe('getAllUsers', () => {
    it('should return all three users', async () => {
      const users = await getAllUsers();
      
      expect(users).toHaveLength(3);
      expect(users.map(u => u.name).sort()).toEqual(['Alex', 'Becky', 'Sam']);
      
      // Verify each user has required fields
      users.forEach(user => {
        expect(user.id).toBeDefined();
        expect(typeof user.id).toBe('string');
        expect(user.name).toMatch(/^(Alex|Becky|Sam)$/);
        expect(user.createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('getUserById', () => {
    it('should return a user when valid ID is provided', async () => {
      const users = await getAllUsers();
      const firstUser = users[0];
      
      const user = await getUserById(firstUser.id);
      
      expect(user).not.toBeNull();
      expect(user?.id).toBe(firstUser.id);
      expect(user?.name).toBe(firstUser.name);
      expect(user?.createdAt).toEqual(firstUser.createdAt);
    });

    it('should return null when user ID does not exist', async () => {
      const user = await getUserById('00000000-0000-0000-0000-000000000000');
      
      expect(user).toBeNull();
    });
  });

  describe('getUserByName', () => {
    it('should return Alex when querying for Alex', async () => {
      const user = await getUserByName('Alex');
      
      expect(user).not.toBeNull();
      expect(user?.name).toBe('Alex');
      expect(user?.id).toBeDefined();
      expect(user?.createdAt).toBeInstanceOf(Date);
    });

    it('should return Becky when querying for Becky', async () => {
      const user = await getUserByName('Becky');
      
      expect(user).not.toBeNull();
      expect(user?.name).toBe('Becky');
    });

    it('should return Sam when querying for Sam', async () => {
      const user = await getUserByName('Sam');
      
      expect(user).not.toBeNull();
      expect(user?.name).toBe('Sam');
    });

    it('should return null when user name does not exist', async () => {
      const user = await getUserByName('NonExistentUser');
      
      expect(user).toBeNull();
    });
  });
});
