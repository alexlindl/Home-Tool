/**
 * UserService tests
 * Tests for user selection logic and session management
 */

import { UserService } from './UserService';
import { User } from '../models/User';
import * as userQueries from '../db/userQueries';

// Mock the database queries
jest.mock('../db/userQueries');

const mockGetAllUsers = userQueries.getAllUsers as jest.MockedFunction<typeof userQueries.getAllUsers>;
const mockGetUserById = userQueries.getUserById as jest.MockedFunction<typeof userQueries.getUserById>;
const mockGetUserByName = userQueries.getUserByName as jest.MockedFunction<typeof userQueries.getUserByName>;

describe('UserService', () => {
  let userService: UserService;

  // Mock users
  const mockUsers: User[] = [
    { id: '1', name: 'Alex', createdAt: new Date('2024-01-01') },
    { id: '2', name: 'Becky', createdAt: new Date('2024-01-01') },
    { id: '3', name: 'Sam', createdAt: new Date('2024-01-01') },
  ];

  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return all users from database', async () => {
      mockGetAllUsers.mockResolvedValue(mockUsers);

      const result = await userService.getAllUsers();

      expect(result).toEqual(mockUsers);
      expect(mockGetAllUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockGetUserById.mockResolvedValue(mockUsers[0]);

      const result = await userService.getUserById('1');

      expect(result).toEqual(mockUsers[0]);
      expect(mockGetUserById).toHaveBeenCalledWith('1');
    });

    it('should return null when user not found', async () => {
      mockGetUserById.mockResolvedValue(null);

      const result = await userService.getUserById('999');

      expect(result).toBeNull();
      expect(mockGetUserById).toHaveBeenCalledWith('999');
    });
  });

  describe('getUserByName', () => {
    it('should return user when found', async () => {
      mockGetUserByName.mockResolvedValue(mockUsers[0]);

      const result = await userService.getUserByName('Alex');

      expect(result).toEqual(mockUsers[0]);
      expect(mockGetUserByName).toHaveBeenCalledWith('Alex');
    });

    it('should return null when user not found', async () => {
      mockGetUserByName.mockResolvedValue(null);

      const result = await userService.getUserByName('Unknown');

      expect(result).toBeNull();
      expect(mockGetUserByName).toHaveBeenCalledWith('Unknown');
    });
  });

  describe('selectUser', () => {
    it('should create session when user exists', async () => {
      mockGetUserById.mockResolvedValue(mockUsers[0]);

      const session = await userService.selectUser('session-1', '1');

      expect(session.userId).toBe('1');
      expect(session.userName).toBe('Alex');
      expect(session.selectedAt).toBeInstanceOf(Date);
      expect(userService.hasActiveSession('session-1')).toBe(true);
    });

    it('should throw error when user not found', async () => {
      mockGetUserById.mockResolvedValue(null);

      await expect(userService.selectUser('session-1', '999')).rejects.toThrow(
        'User with ID 999 not found'
      );
      expect(userService.hasActiveSession('session-1')).toBe(false);
    });

    it('should update session when selecting different user', async () => {
      mockGetUserById.mockResolvedValueOnce(mockUsers[0]);
      mockGetUserById.mockResolvedValueOnce(mockUsers[1]);

      await userService.selectUser('session-1', '1');
      const session2 = await userService.selectUser('session-1', '2');

      expect(session2.userId).toBe('2');
      expect(session2.userName).toBe('Becky');
    });
  });

  describe('selectUserByName', () => {
    it('should create session when user exists', async () => {
      mockGetUserByName.mockResolvedValue(mockUsers[1]);

      const session = await userService.selectUserByName('session-1', 'Becky');

      expect(session.userId).toBe('2');
      expect(session.userName).toBe('Becky');
      expect(session.selectedAt).toBeInstanceOf(Date);
      expect(userService.hasActiveSession('session-1')).toBe(true);
    });

    it('should throw error when user not found', async () => {
      mockGetUserByName.mockResolvedValue(null);

      await expect(userService.selectUserByName('session-1', 'Unknown')).rejects.toThrow(
        'User with name Unknown not found'
      );
      expect(userService.hasActiveSession('session-1')).toBe(false);
    });
  });

  describe('getCurrentSession', () => {
    it('should return session when exists', async () => {
      mockGetUserById.mockResolvedValue(mockUsers[0]);
      await userService.selectUser('session-1', '1');

      const session = userService.getCurrentSession('session-1');

      expect(session).not.toBeNull();
      expect(session?.userId).toBe('1');
      expect(session?.userName).toBe('Alex');
    });

    it('should return null when session does not exist', () => {
      const session = userService.getCurrentSession('non-existent');

      expect(session).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user when session exists', async () => {
      mockGetUserById.mockResolvedValueOnce(mockUsers[0]);
      mockGetUserById.mockResolvedValueOnce(mockUsers[0]);
      
      await userService.selectUser('session-1', '1');
      const user = await userService.getCurrentUser('session-1');

      expect(user).toEqual(mockUsers[0]);
    });

    it('should return null when session does not exist', async () => {
      const user = await userService.getCurrentUser('non-existent');

      expect(user).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('should clear existing session', async () => {
      mockGetUserById.mockResolvedValue(mockUsers[0]);
      await userService.selectUser('session-1', '1');

      const result = userService.clearSession('session-1');

      expect(result).toBe(true);
      expect(userService.hasActiveSession('session-1')).toBe(false);
    });

    it('should return false when session does not exist', () => {
      const result = userService.clearSession('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('hasActiveSession', () => {
    it('should return true when session exists', async () => {
      mockGetUserById.mockResolvedValue(mockUsers[0]);
      await userService.selectUser('session-1', '1');

      expect(userService.hasActiveSession('session-1')).toBe(true);
    });

    it('should return false when session does not exist', () => {
      expect(userService.hasActiveSession('non-existent')).toBe(false);
    });
  });

  describe('getAllSessions', () => {
    it('should return all active sessions', async () => {
      mockGetUserById.mockResolvedValueOnce(mockUsers[0]);
      mockGetUserById.mockResolvedValueOnce(mockUsers[1]);

      await userService.selectUser('session-1', '1');
      await userService.selectUser('session-2', '2');

      const sessions = userService.getAllSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].userName).toBe('Alex');
      expect(sessions[1].userName).toBe('Becky');
    });

    it('should return empty array when no sessions', () => {
      const sessions = userService.getAllSessions();

      expect(sessions).toHaveLength(0);
    });
  });

  describe('clearAllSessions', () => {
    it('should clear all sessions', async () => {
      mockGetUserById.mockResolvedValueOnce(mockUsers[0]);
      mockGetUserById.mockResolvedValueOnce(mockUsers[1]);

      await userService.selectUser('session-1', '1');
      await userService.selectUser('session-2', '2');

      userService.clearAllSessions();

      expect(userService.getAllSessions()).toHaveLength(0);
      expect(userService.hasActiveSession('session-1')).toBe(false);
      expect(userService.hasActiveSession('session-2')).toBe(false);
    });
  });

  describe('session management - user action association', () => {
    it('should associate actions with selected user', async () => {
      mockGetUserById.mockResolvedValue(mockUsers[0]);
      
      // User selects their identity
      await userService.selectUser('session-1', '1');
      
      // Verify all subsequent actions can be attributed to this user
      const session = userService.getCurrentSession('session-1');
      expect(session?.userId).toBe('1');
      expect(session?.userName).toBe('Alex');
      
      // Simulate multiple actions - all should be associated with Alex
      const action1User = userService.getCurrentSession('session-1');
      const action2User = userService.getCurrentSession('session-1');
      const action3User = userService.getCurrentSession('session-1');
      
      expect(action1User?.userName).toBe('Alex');
      expect(action2User?.userName).toBe('Alex');
      expect(action3User?.userName).toBe('Alex');
    });

    it('should maintain separate sessions for different devices', async () => {
      mockGetUserById.mockResolvedValueOnce(mockUsers[0]);
      mockGetUserById.mockResolvedValueOnce(mockUsers[1]);
      
      // Device 1 selects Alex
      await userService.selectUser('device-1', '1');
      
      // Device 2 selects Becky
      await userService.selectUser('device-2', '2');
      
      // Verify each device maintains its own session
      const device1Session = userService.getCurrentSession('device-1');
      const device2Session = userService.getCurrentSession('device-2');
      
      expect(device1Session?.userName).toBe('Alex');
      expect(device2Session?.userName).toBe('Becky');
    });
  });
});
