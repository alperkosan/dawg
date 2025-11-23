/**
 * Notification service for media panel
 */

import { apiClient } from '@/services/api.js';

class NotificationService {
  /**
   * Get notifications for the current user
   */
  async getNotifications(filters = {}) {
    try {
      return await apiClient.getNotifications(filters);
    } catch (error) {
      console.error('Failed to get notifications:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId) {
    try {
      return await apiClient.markNotificationAsRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      return await apiClient.markAllNotificationsAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async delete(notificationId) {
    try {
      return await apiClient.deleteNotification(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw error;
    }
  }

  /**
   * Get notification settings
   */
  async getSettings() {
    try {
      return await apiClient.getNotificationSettings();
    } catch (error) {
      console.error('Failed to get notification settings:', error);
      throw error;
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(settings) {
    try {
      return await apiClient.updateNotificationSettings(settings);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;

