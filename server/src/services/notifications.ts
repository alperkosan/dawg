/**
 * Notification service
 */

import { Pool } from 'pg';
import { getDatabase } from './database.js';
import { logger } from '../utils/logger.js';
import { sendNotificationToUser } from './websocket-manager.js';

export interface NotificationData {
  projectId?: string;
  projectTitle?: string;
  likedByUserId?: string;
  commentedByUserId?: string;
  commentedByUsername?: string;
  commentId?: string;
  parentCommentId?: string;
  repliedByUserId?: string;
  repliedByUsername?: string;
  remixedByUserId?: string;
  originalProjectId?: string;
  originalProjectTitle?: string;
  remixProjectId?: string;
  remixProjectTitle?: string;
  followerUserId?: string;
  followerUsername?: string;
  [key: string]: any;
}

export interface CreateNotificationParams {
  userId: string;
  type: string;
  data: NotificationData;
}

/**
 * Create a notification
 */
export async function createNotification(
  db: Pool,
  params: CreateNotificationParams
): Promise<void> {
  try {
    const result = await db.query(
      'INSERT INTO notifications (user_id, type, data) VALUES ($1, $2, $3) RETURNING id, user_id, type, data, is_read, created_at',
      [params.userId, params.type, JSON.stringify(params.data)]
    );
    
    const notification = result.rows[0];
    
    // Send real-time notification via WebSocket
    sendNotificationToUser(params.userId, {
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      data: notification.data,
      isRead: notification.is_read,
      createdAt: notification.created_at,
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  db: Pool,
  userId: string,
  options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
  } = {}
): Promise<{
  notifications: any[];
  unreadCount: number;
  total: number;
}> {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (options.unreadOnly) {
    conditions.push('is_read = false');
  }

  if (options.type) {
    conditions.push(`type = $${paramIndex}`);
    params.push(options.type);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get notifications
  const result = await db.query(
    `SELECT id, user_id, type, data, is_read, created_at
     FROM notifications
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  // Get unread count
  const unreadResult = await db.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  const unreadCount = parseInt(unreadResult.rows[0]?.count || '0', 10);

  // Get total count
  const totalResult = await db.query(
    `SELECT COUNT(*) as count FROM notifications ${whereClause}`,
    params
  );
  const total = parseInt(totalResult.rows[0]?.count || '0', 10);

  return {
    notifications: result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      data: row.data,
      isRead: row.is_read,
      createdAt: row.created_at,
    })),
    unreadCount,
    total,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  db: Pool,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await db.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
    [notificationId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(
  db: Pool,
  userId: string
): Promise<number> {
  const result = await db.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING id',
    [userId]
  );
  return result.rows.length;
}

/**
 * Delete notification
 */
export async function deleteNotification(
  db: Pool,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
    [notificationId, userId]
  );
  return result.rows.length > 0;
}

