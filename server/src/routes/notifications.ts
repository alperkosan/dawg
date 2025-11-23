/**
 * Notification routes for media panel
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../services/database.js';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/notifications.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const NotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().optional(),
  type: z.string().optional(),
});

const NotificationSettingsSchema = z.object({
  emailOnLike: z.boolean().optional(),
  emailOnComment: z.boolean().optional(),
  emailOnFollow: z.boolean().optional(),
  emailOnRemix: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export async function notificationRoutes(server: FastifyInstance) {
  // GET /api/notifications - Get user notifications
  server.get('/', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const query = NotificationsQuerySchema.parse(request.query);
      const db = getDatabase();

      const result = await getNotifications(db, userId, {
        page: query.page,
        limit: query.limit,
        unreadOnly: query.unreadOnly,
        type: query.type,
      });

      return reply.send({
        notifications: result.notifications,
        unreadCount: result.unreadCount,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          hasMore: (query.page - 1) * query.limit + result.notifications.length < result.total,
        },
      });
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid query parameters', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/notifications/:notificationId/read - Mark notification as read
  server.put('/:notificationId/read', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { notificationId } = request.params as { notificationId: string };
      const userId = request.user!.userId;
      const db = getDatabase();

      const success = await markNotificationAsRead(db, notificationId, userId);
      if (!success) {
        throw new NotFoundError('Notification not found');
      }

      return reply.send({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/notifications/read-all - Mark all notifications as read
  server.put('/read-all', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const db = getDatabase();

      const count = await markAllNotificationsAsRead(db, userId);

      return reply.send({
        success: true,
        message: `Marked ${count} notifications as read`,
        count,
      });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/notifications/:notificationId - Delete notification
  server.delete('/:notificationId', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { notificationId } = request.params as { notificationId: string };
      const userId = request.user!.userId;
      const db = getDatabase();

      const success = await deleteNotification(db, notificationId, userId);
      if (!success) {
        throw new NotFoundError('Notification not found');
      }

      return reply.send({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/notifications/settings - Get notification preferences
  server.get('/settings', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const db = getDatabase();

      // For now, return default settings
      // In the future, we can add a user_preferences table
      return reply.send({
        emailOnLike: true,
        emailOnComment: true,
        emailOnFollow: true,
        emailOnRemix: true,
        pushEnabled: true,
      });
    } catch (error) {
      logger.error('Error fetching notification settings:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/notifications/settings - Update notification preferences
  server.put('/settings', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const body = NotificationSettingsSchema.parse(request.body);

      // For now, just return success
      // In the future, we can add a user_preferences table to store these
      return reply.send({
        success: true,
        message: 'Notification settings updated',
        settings: body,
      });
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request body', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

