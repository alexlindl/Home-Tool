/**
 * User Service
 * Handles business logic for user operations including user selection and session management
 */

import { User } from '../models/User';
import { getAllUsers, getUserById, getUserByName } from '../db/userQueries';

/**
 * Session data for tracking current user
 */
export interface UserSession {
  userId: string;
  userName: string;
  selectedAt: Date;
}

/**
 * UserService class
 * Manages user selection logic and session tracking
 */
export class UserService {
  private sessions: Map<string, UserSession>;

  constructor() {
    this.sessions = new Map();
  }

  /**
   * Get all available users
   * @returns Promise<User[]> Array of all users
   */
  async getAllUsers(): Promise<User[]> {
    return await getAllUsers();
  }

  /**
   * Get a user by ID
   * @param id User UUID
   * @returns Promise<User | null> User object or null if not found
   */
  async getUserById(id: string): Promise<User | null> {
    return await getUserById(id);
  }

  /**
   * Get a user by name
   * @param name User name (Alex, Becky, or Sam)
   * @returns Promise<User | null> User object or null if not found
   */
  async getUserByName(name: string): Promise<User | null> {
    return await getUserByName(name);
  }

  /**
   * Select a user for a session
   * Associates all subsequent actions with the selected user
   * @param sessionId Unique session identifier (e.g., device ID, session token)
   * @param userId User UUID to select
   * @returns Promise<UserSession> Created session data
   * @throws Error if user not found
   */
  async selectUser(sessionId: string, userId: string): Promise<UserSession> {
    const user = await getUserById(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const session: UserSession = {
      userId: user.id,
      userName: user.name,
      selectedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Select a user by name for a session
   * Convenience method for selecting by name instead of ID
   * @param sessionId Unique session identifier
   * @param userName User name (Alex, Becky, or Sam)
   * @returns Promise<UserSession> Created session data
   * @throws Error if user not found
   */
  async selectUserByName(sessionId: string, userName: string): Promise<UserSession> {
    const user = await getUserByName(userName);
    
    if (!user) {
      throw new Error(`User with name ${userName} not found`);
    }

    const session: UserSession = {
      userId: user.id,
      userName: user.name,
      selectedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get the current user session
   * @param sessionId Unique session identifier
   * @returns UserSession | null Session data or null if no user selected
   */
  getCurrentSession(sessionId: string): UserSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get the current user for a session
   * @param sessionId Unique session identifier
   * @returns Promise<User | null> Current user or null if no user selected
   */
  async getCurrentUser(sessionId: string): Promise<User | null> {
    const session = this.getCurrentSession(sessionId);
    
    if (!session) {
      return null;
    }

    return await getUserById(session.userId);
  }

  /**
   * Clear a user session
   * @param sessionId Unique session identifier
   * @returns boolean True if session was cleared, false if no session existed
   */
  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Check if a session has a user selected
   * @param sessionId Unique session identifier
   * @returns boolean True if user is selected for this session
   */
  hasActiveSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get all active sessions (for debugging/monitoring)
   * @returns UserSession[] Array of all active sessions
   */
  getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear all sessions (for testing/cleanup)
   */
  clearAllSessions(): void {
    this.sessions.clear();
  }
}

// Export singleton instance
export const userService = new UserService();
