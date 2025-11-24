/**
 * WebSocket routes for real-time collaboration
 */

import { FastifyInstance } from 'fastify';
import {
  joinSession,
  leaveSession,
  updateCursor,
  getSessionUsers,
  getSessionUserIds,
} from '../services/collaboration.js';
import {
  registerConnection,
  unregisterConnection,
  broadcastToProject,
  sendToUser,
} from '../services/websocket-manager.js';
import { canAccessProject } from '../services/projects.js';
import { findUserById } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import { JWTPayload } from '../middleware/auth.js';

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export async function registerWebSocketRoutes(server: FastifyInstance) {
  server.get('/ws', { websocket: true }, async (connection, request) => {
    let userId: string | null = null;
    let projectId: string | null = null;
    let username: string | null = null;
    
    // Authenticate WebSocket connection
    connection.socket.on('message', async (message: Buffer) => {
      try {
        const msg: WebSocketMessage = JSON.parse(message.toString());
        
        // Handle connection
        if (msg.type === 'connect') {
          // Verify JWT token
          const token = msg.data?.token;
          if (!token) {
            connection.socket.send(JSON.stringify({
              type: 'error',
              data: { message: 'Token required' },
            }));
            connection.socket.close();
            return;
          }
          
          try {
            const decoded = await server.jwt.verify<JWTPayload>(token);
            // ✅ FIX: Type-safe JWT payload access
            if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
              const payload = decoded as JWTPayload;
              userId = payload.userId;
              username = payload.username;
            }
            
            // Get project ID
            projectId = msg.data?.projectId;
            if (!projectId) {
              connection.socket.send(JSON.stringify({
                type: 'error',
                data: { message: 'Project ID required' },
              }));
              connection.socket.close();
              return;
            }
            
            // Check access
            const hasAccess = await canAccessProject(userId, projectId);
            if (!hasAccess) {
              connection.socket.send(JSON.stringify({
                type: 'error',
                data: { message: 'Access denied' },
              }));
              connection.socket.close();
              return;
            }
            
            // Get user details
            const user = await findUserById(userId);
            if (!user) {
              connection.socket.close();
              return;
            }
            
            // Join session
            const session = await joinSession(
              projectId,
              userId,
              username,
              user.display_name || user.displayName
            );
            
            // Send connection success
            connection.socket.send(JSON.stringify({
              type: 'connected',
              data: {
                userId,
                projectId,
                timestamp: Date.now(),
              },
            }));
            
            // Register WebSocket connection
            registerConnection(projectId, userId, connection.socket);
            
            // Send current session users
            const users = getSessionUsers(projectId);
            sendToUser(projectId, userId, {
              type: 'session:users',
              data: {
                users: users.map(u => ({
                  userId: u.userId,
                  username: u.username,
                  displayName: u.displayName,
                  cursor: u.cursor,
                })),
              },
            });
            
            // Broadcast user joined to others
            broadcastToProject(projectId, {
              type: 'collaboration:user_joined',
              data: {
                userId,
                username,
                displayName: user.display_name || user.displayName,
                timestamp: Date.now(),
              },
            }, userId);
            
            logger.info(`WebSocket connected: user ${userId} to project ${projectId}`);
          } catch (error: any) {
            logger.error('WebSocket authentication failed', error);
            connection.socket.send(JSON.stringify({
              type: 'error',
              data: { message: 'Authentication failed' },
            }));
            connection.socket.close();
            return;
          }
          
          return;
        }
        
        // Only process messages after connection
        if (!userId || !projectId) {
          return;
        }
        
        // Handle cursor movement
        if (msg.type === 'collaboration:cursor_moved') {
          updateCursor(projectId, userId, msg.data?.cursor || {});
          
          // Broadcast to other users
          broadcastToProject(projectId, {
            type: 'collaboration:cursor_moved',
            data: {
              userId,
              cursor: msg.data?.cursor,
              timestamp: Date.now(),
            },
          }, userId);
          
          return;
        }
        
        // Handle project changes
        if (msg.type === 'collaboration:change') {
          // Validate change
          if (!msg.data?.change) {
            return;
          }
          
          // Broadcast to all users (including sender for confirmation)
          broadcastToProject(projectId, {
            type: 'collaboration:change',
            data: {
              userId,
              change: msg.data.change,
              timestamp: Date.now(),
            },
          });
          
          return;
        }
        
        // Handle ping (keep-alive)
        if (msg.type === 'ping') {
          connection.socket.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
          }));
          return;
        }
        
      } catch (error: any) {
        logger.error('WebSocket message error', error);
        connection.socket.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' },
        }));
      }
    });
    
    // Handle disconnect
    connection.socket.on('close', () => {
      if (userId && projectId) {
        leaveSession(projectId, userId);
        unregisterConnection(projectId, userId);
        
        // Broadcast user left
        broadcastToProject(projectId, {
          type: 'collaboration:user_left',
          data: {
            userId,
            timestamp: Date.now(),
          },
        }, userId);
        
        logger.info(`WebSocket disconnected: user ${userId} from project ${projectId}`);
      }
    });
    
    // Handle errors
    connection.socket.on('error', (error) => {
      logger.error('WebSocket error', error);
      if (userId && projectId) {
        leaveSession(projectId, userId);
        unregisterConnection(projectId, userId);
      }
    });
  });
}


