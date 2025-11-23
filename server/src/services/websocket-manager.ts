/**
 * WebSocket connection manager
 * Tracks active WebSocket connections for broadcasting
 */

import { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

interface Connection {
  socket: WebSocket;
  userId: string;
  projectId: string;
  connectedAt: Date;
}

// Map<projectId, Map<userId, Connection>>
const connections = new Map<string, Map<string, Connection>>();

// Map<userId, Set<Connection>> - For notifications (user can be in multiple projects)
const userConnections = new Map<string, Set<Connection>>();

/**
 * Register WebSocket connection
 */
export function registerConnection(
  projectId: string,
  userId: string,
  socket: WebSocket
): void {
  if (!connections.has(projectId)) {
    connections.set(projectId, new Map());
  }
  
  const projectConnections = connections.get(projectId)!;
  const connection: Connection = {
    socket,
    userId,
    projectId,
    connectedAt: new Date(),
  };
  projectConnections.set(userId, connection);
  
  // Also register for user-based notifications
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(connection);
  
  logger.debug(`Registered WebSocket connection: user ${userId} to project ${projectId}`);
}

/**
 * Unregister WebSocket connection
 */
export function unregisterConnection(projectId: string, userId: string): void {
  const projectConnections = connections.get(projectId);
  if (projectConnections) {
    const connection = projectConnections.get(userId);
    projectConnections.delete(userId);
    
    // Clean up empty project connections
    if (projectConnections.size === 0) {
      connections.delete(projectId);
    }
    
    // Also remove from user connections
    if (connection) {
      const userConns = userConnections.get(userId);
      if (userConns) {
        userConns.delete(connection);
        if (userConns.size === 0) {
          userConnections.delete(userId);
        }
      }
    }
  }
  
  logger.debug(`Unregistered WebSocket connection: user ${userId} from project ${projectId}`);
}

/**
 * Broadcast message to all users in a project (except excludeUserId)
 */
export function broadcastToProject(
  projectId: string,
  message: any,
  excludeUserId?: string
): void {
  const projectConnections = connections.get(projectId);
  if (!projectConnections) {
    return;
  }
  
  const messageStr = JSON.stringify(message);
  let sentCount = 0;
  
  for (const [userId, connection] of projectConnections.entries()) {
    if (userId === excludeUserId) {
      continue;
    }
    
    if (connection.socket.readyState === WebSocket.OPEN) {
      try {
        connection.socket.send(messageStr);
        sentCount++;
      } catch (error) {
        logger.error(`Failed to send message to user ${userId}`, error);
        // Remove dead connection
        projectConnections.delete(userId);
      }
    } else {
      // Remove closed connection
      projectConnections.delete(userId);
    }
  }
  
  if (sentCount > 0) {
    logger.debug(`Broadcasted message to ${sentCount} users in project ${projectId}`);
  }
}

/**
 * Send message to specific user
 */
export function sendToUser(projectId: string, userId: string, message: any): boolean {
  const projectConnections = connections.get(projectId);
  if (!projectConnections) {
    return false;
  }
  
  const connection = projectConnections.get(userId);
  if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  
  try {
    connection.socket.send(JSON.stringify(message));
    return true;
  } catch (error) {
    logger.error(`Failed to send message to user ${userId}`, error);
    projectConnections.delete(userId);
    return false;
  }
}

/**
 * Get active connections for a project
 */
export function getProjectConnections(projectId: string): string[] {
  const projectConnections = connections.get(projectId);
  if (!projectConnections) {
    return [];
  }
  
  return Array.from(projectConnections.keys());
}

/**
 * Clean up dead connections
 */
export function cleanupConnections(): void {
  for (const [projectId, projectConnections] of connections.entries()) {
    for (const [userId, connection] of projectConnections.entries()) {
      if (connection.socket.readyState === WebSocket.CLOSED || 
          connection.socket.readyState === WebSocket.CLOSING) {
        projectConnections.delete(userId);
        logger.debug(`Cleaned up dead connection: user ${userId} from project ${projectId}`);
      }
    }
    
    // Remove empty project connections
    if (projectConnections.size === 0) {
      connections.delete(projectId);
    }
  }
}

/**
 * Send notification to user (across all their connections)
 */
export function sendNotificationToUser(userId: string, notification: any): boolean {
  const userConns = userConnections.get(userId);
  if (!userConns || userConns.size === 0) {
    return false;
  }
  
  const messageStr = JSON.stringify({
    type: 'notification:new',
    data: notification,
    timestamp: Date.now(),
  });
  
  let sentCount = 0;
  const deadConnections: Connection[] = [];
  
  for (const connection of userConns) {
    if (connection.socket.readyState === WebSocket.OPEN) {
      try {
        connection.socket.send(messageStr);
        sentCount++;
      } catch (error) {
        logger.error(`Failed to send notification to user ${userId}`, error);
        deadConnections.push(connection);
      }
    } else {
      deadConnections.push(connection);
    }
  }
  
  // Clean up dead connections
  for (const deadConn of deadConnections) {
    userConns.delete(deadConn);
    const projectConns = connections.get(deadConn.projectId);
    if (projectConns) {
      projectConns.delete(deadConn.userId);
    }
  }
  
  if (userConns.size === 0) {
    userConnections.delete(userId);
  }
  
  return sentCount > 0;
}

// Cleanup every minute
setInterval(cleanupConnections, 60 * 1000);

