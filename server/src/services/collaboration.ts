/**
 * Collaboration service
 * Manages real-time collaboration sessions
 */

import { getDatabase } from './database.js';
import { logger } from '../utils/logger.js';
import { canAccessProject } from './projects.js';

interface CollaborationSession {
  projectId: string;
  users: Map<string, CollaborationUser>;
  createdAt: Date;
}

interface CollaborationUser {
  userId: string;
  username: string;
  displayName?: string;
  cursor?: {
    trackId?: string;
    position?: number;
    tool?: string;
  };
  joinedAt: Date;
  lastSeen: Date;
}

// In-memory session store (can be moved to Redis for production)
const sessions = new Map<string, CollaborationSession>();

/**
 * Get or create collaboration session
 */
export function getOrCreateSession(projectId: string): CollaborationSession {
  if (!sessions.has(projectId)) {
    sessions.set(projectId, {
      projectId,
      users: new Map(),
      createdAt: new Date(),
    });
  }
  return sessions.get(projectId)!;
}

/**
 * Join collaboration session
 */
export async function joinSession(
  projectId: string,
  userId: string,
  username: string,
  displayName?: string
): Promise<CollaborationSession> {
  const session = getOrCreateSession(projectId);
  
  // Check if user already in session
  if (session.users.has(userId)) {
    const user = session.users.get(userId)!;
    user.lastSeen = new Date();
    return session;
  }
  
  // Add user to session
  session.users.set(userId, {
    userId,
    username,
    displayName,
    joinedAt: new Date(),
    lastSeen: new Date(),
  });
  
  // Update database (last_active_at)
  const db = getDatabase();
  await db.query(
    `UPDATE project_collaborators
     SET last_active_at = NOW()
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  
  logger.info(`User ${userId} joined collaboration session for project ${projectId}`);
  
  return session;
}

/**
 * Leave collaboration session
 */
export function leaveSession(projectId: string, userId: string): void {
  const session = sessions.get(projectId);
  if (!session) {
    return;
  }
  
  session.users.delete(userId);
  
  // Clean up empty sessions
  if (session.users.size === 0) {
    sessions.delete(projectId);
    logger.info(`Collaboration session for project ${projectId} closed`);
  } else {
    logger.info(`User ${userId} left collaboration session for project ${projectId}`);
  }
}

/**
 * Update user cursor
 */
export function updateCursor(
  projectId: string,
  userId: string,
  cursor: { trackId?: string; position?: number; tool?: string }
): void {
  const session = sessions.get(projectId);
  if (!session) {
    return;
  }
  
  const user = session.users.get(userId);
  if (user) {
    user.cursor = cursor;
    user.lastSeen = new Date();
  }
}

/**
 * Get session users
 */
export function getSessionUsers(projectId: string): CollaborationUser[] {
  const session = sessions.get(projectId);
  if (!session) {
    return [];
  }
  
  return Array.from(session.users.values());
}

/**
 * Broadcast change to all users in session (except sender)
 */
export function getSessionUserIds(projectId: string, excludeUserId?: string): string[] {
  const session = sessions.get(projectId);
  if (!session) {
    return [];
  }
  
  return Array.from(session.users.keys()).filter(id => id !== excludeUserId);
}

/**
 * Clean up inactive sessions (remove users inactive for > 5 minutes)
 */
export function cleanupInactiveSessions(): void {
  const now = new Date();
  const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
  
  for (const [projectId, session] of sessions.entries()) {
    for (const [userId, user] of session.users.entries()) {
      const inactiveTime = now.getTime() - user.lastSeen.getTime();
      if (inactiveTime > inactiveThreshold) {
        session.users.delete(userId);
        logger.info(`Removed inactive user ${userId} from session ${projectId}`);
      }
    }
    
    // Remove empty sessions
    if (session.users.size === 0) {
      sessions.delete(projectId);
    }
  }
}

// Cleanup every 2 minutes
setInterval(cleanupInactiveSessions, 2 * 60 * 1000);

