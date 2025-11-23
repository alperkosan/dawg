/**
 * Custom hook for managing notifications
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api.js';

export function useNotifications(filters = {}) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const loadNotifications = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsFetchingNextPage(true);
      }

      const response = await apiClient.getNotifications({
        page,
        limit: 20,
        ...filters,
      });

      if (append) {
        setNotifications((prev) => [...prev, ...response.notifications]);
      } else {
        setNotifications(response.notifications);
      }

      setUnreadCount(response.unreadCount || 0);
      setHasNextPage(response.pagination?.hasMore || false);
      setCurrentPage(page);
    } catch (err) {
      setError(err);
      setTimeout(() => {
        apiClient.showToast('Failed to load notifications', 'error');
      }, 0);
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [filters]);

  useEffect(() => {
    setCurrentPage(1);
    setNotifications([]);
    loadNotifications(1, false);
  }, [filters, loadNotifications]);

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      loadNotifications(currentPage + 1, true);
    }
  }, [currentPage, hasNextPage, isFetchingNextPage, loadNotifications]);

  const refresh = useCallback(() => {
    loadNotifications(1, false);
  }, [loadNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiClient.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      apiClient.showToast('Failed to mark notification as read', 'error');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      apiClient.showToast('All notifications marked as read', 'success');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      apiClient.showToast('Failed to mark all notifications as read', 'error');
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await apiClient.deleteNotification(notificationId);
      const deleted = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (deleted && !deleted.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      apiClient.showToast('Failed to delete notification', 'error');
    }
  }, [notifications]);

  return {
    notifications,
    isLoading,
    error,
    unreadCount,
    hasNextPage,
    isFetchingNextPage,
    loadMore,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

