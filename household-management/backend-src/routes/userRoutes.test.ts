/**
 * User routes unit tests
 * Tests the user API endpoints
 */

import request from 'supertest';
import app from '../index';
import { userService } from '../services/UserService';
import * as userQueries from '../db/userQueries';

// Mock the database queries
jest.mock('../db/userQueries');

describe('User API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userService.clearAllSessions();
  });

  describe('GET /api/users', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: '1', name: 'Alex' as const, haUsername: null, createdAt: new Date('2024-01-01') },
        { id: '2', name: 'Becky' as const, haUsername: null, createdAt: new Date('2024-01-01') },
        { id: '3', name: 'Sam' as const, haUsername: null, createdAt: new Date('2024-01-01') },
      ];

      (userQueries.getAllUsers as jest.Mock).mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body.users).toHaveLength(3);
      expect(response.body.users[0]).toHaveProperty('name', 'Alex');
      expect(response.body.users[1]).toHaveProperty('name', 'Becky');
      expect(response.body.users[2]).toHaveProperty('name', 'Sam');
    });

    it('should handle database errors gracefully', async () => {
      (userQueries.getAllUsers as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/users')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch users');
    });
  });

  describe('POST /api/users/select', () => {
    const mockUser = {
      id: 'user-123',
      name: 'Alex' as const,
      haUsername: null,
      createdAt: new Date('2024-01-01'),
    };

    it('should select user by userId', async () => {
      (userQueries.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users/select')
        .send({ userId: 'user-123' })
        .expect(200);

      expect(response.body).toHaveProperty('session');
      expect(response.body.session).toHaveProperty('userId', 'user-123');
      expect(response.body.session).toHaveProperty('userName', 'Alex');
      expect(response.body.session).toHaveProperty('selectedAt');
    });

    it('should select user by userName', async () => {
      (userQueries.getUserByName as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users/select')
        .send({ userName: 'Alex' })
        .expect(200);

      expect(response.body).toHaveProperty('session');
      expect(response.body.session).toHaveProperty('userId', 'user-123');
      expect(response.body.session).toHaveProperty('userName', 'Alex');
      expect(response.body.session).toHaveProperty('selectedAt');
    });

    it('should return 400 if neither userId nor userName provided', async () => {
      const response = await request(app)
        .post('/api/users/select')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('Either userId or userName is required');
    });

    it('should return 400 for invalid userName', async () => {
      const response = await request(app)
        .post('/api/users/select')
        .send({ userName: 'InvalidName' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('Invalid userName');
      expect(response.body.message).toContain('Alex, Becky, Sam');
    });

    it('should return 404 if user not found by userId', async () => {
      (userQueries.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/users/select')
        .send({ userId: 'nonexistent-id' })
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 404 if user not found by userName', async () => {
      (userQueries.getUserByName as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/users/select')
        .send({ userName: 'Alex' })
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should handle database errors gracefully', async () => {
      (userQueries.getUserById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/users/select')
        .send({ userId: 'user-123' })
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to select user');
    });

    it('should use custom session ID from header if provided', async () => {
      (userQueries.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const customSessionId = 'custom-session-123';
      
      const response = await request(app)
        .post('/api/users/select')
        .set('x-session-id', customSessionId)
        .send({ userId: 'user-123' })
        .expect(200);

      expect(response.body).toHaveProperty('session');
      
      // Verify the session was stored with the custom ID
      const session = userService.getCurrentSession(customSessionId);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe('user-123');
    });
  });

  describe('Validation middleware', () => {
    it('should sanitize string inputs', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Alex' as const,
        haUsername: null,
        createdAt: new Date('2024-01-01'),
      };

      (userQueries.getUserByName as jest.Mock).mockResolvedValue(mockUser);

      // Send userName with extra whitespace
      const response = await request(app)
        .post('/api/users/select')
        .send({ userName: '  Alex  ' })
        .expect(200);

      expect(response.body).toHaveProperty('session');
      // Verify the service was called with trimmed value
      expect(userQueries.getUserByName).toHaveBeenCalledWith('Alex');
    });
  });
});
