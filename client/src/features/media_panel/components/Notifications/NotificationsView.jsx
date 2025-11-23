/**
 * Notifications View - User notifications with filters and settings
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bell, 
  Heart, 
  MessageCircle, 
  GitBranch, 
  UserPlus, 
  X, 
  Check, 
  Settings,
  Filter,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '@/services/api.js';
import './NotificationsView.css';

const NOTIFICATION_TYPES = {
  PROJECT_LIKED: 'project_liked',
  PROJECT_COMMENTED: 'project_commented',
  COMMENT_REPLIED: 'comment_replied',
  PROJECT_REMIXED: 'project_remixed',
  USER_FOLLOWED: 'user_followed',
};

const TYPE_LABELS = {
  [NOTIFICATION_TYPES.PROJECT_LIKED]: 'Liked your project',
  [NOTIFICATION_TYPES.PROJECT_COMMENTED]: 'Commented on your project',
  [NOTIFICATION_TYPES.COMMENT_REPLIED]: 'Replied to your comment',
  [NOTIFICATION_TYPES.PROJECT_REMIXED]: 'Remixed your project',
  [NOTIFICATION_TYPES.USER_FOLLOWED]: 'Started following you',
};

const TYPE_ICONS = {
  [NOTIFICATION_TYPES.PROJECT_LIKED]: Heart,
  [NOTIFICATION_TYPES.PROJECT_COMMENTED]: MessageCircle,
  [NOTIFICATION_TYPES.COMMENT_REPLIED]: MessageCircle,
  [NOTIFICATION_TYPES.PROJECT_REMIXED]: GitBranch,
  [NOTIFICATION_TYPES.USER_FOLLOWED]: UserPlus,
};

function NotificationItem({ notification, onMarkRead, onDelete, onNavigate }) {
  const Icon = TYPE_ICONS[notification.type] || Bell;
  const isRead = notification.isRead || false;

  const handleClick = () => {
    if (!isRead) {
      onMarkRead(notification.id);
    }
    if (onNavigate && notification.data?.projectId) {
      onNavigate(notification.data.projectId);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationMessage = () => {
    const data = notification.data || {};
    const type = notification.type;

    switch (type) {
      case NOTIFICATION_TYPES.PROJECT_LIKED:
        return (
          <>
            <strong>{data.likedByUsername || 'Someone'}</strong> liked your project{' '}
            <strong>{data.projectTitle || 'Untitled'}</strong>
          </>
        );
      case NOTIFICATION_TYPES.PROJECT_COMMENTED:
        return (
          <>
            <strong>{data.commentedByUsername || 'Someone'}</strong> commented on your project{' '}
            <strong>{data.projectTitle || 'Untitled'}</strong>
          </>
        );
      case NOTIFICATION_TYPES.COMMENT_REPLIED:
        return (
          <>
            <strong>{data.repliedByUsername || 'Someone'}</strong> replied to your comment
          </>
        );
      case NOTIFICATION_TYPES.PROJECT_REMIXED:
        return (
          <>
            <strong>{data.remixedByUsername || 'Someone'}</strong> remixed your project{' '}
            <strong>{data.originalProjectTitle || 'Untitled'}</strong>
          </>
        );
      case NOTIFICATION_TYPES.USER_FOLLOWED:
        return (
          <>
            <strong>{data.followerUsername || 'Someone'}</strong> started following you
          </>
        );
      default:
        return 'New notification';
    }
  };

  return (
    <div 
      className={`notification-item ${isRead ? 'read' : 'unread'}`}
      onClick={handleClick}
    >
      <div className="notification-item__icon">
        <Icon size={20} />
      </div>
      <div className="notification-item__content">
        <p className="notification-item__message">{getNotificationMessage()}</p>
        <span className="notification-item__time">{formatTime(notification.createdAt)}</span>
      </div>
      <div className="notification-item__actions">
        {!isRead && (
          <button
            className="notification-item__action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            title="Mark as read"
          >
            <Check size={16} />
          </button>
        )}
        <button
          className="notification-item__action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          title="Delete"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filters, setFilters] = useState({
    unreadOnly: false,
    type: null,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollContainerRef = useRef(null);
  const observerRef = useRef(null);

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
        unreadOnly: filters.unreadOnly || undefined,
        type: filters.type || undefined,
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

  const handleMarkRead = async (notificationId) => {
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
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      apiClient.showToast('All notifications marked as read', 'success');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      apiClient.showToast('Failed to mark all notifications as read', 'error');
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await apiClient.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      // Update unread count if deleted notification was unread
      const deleted = notifications.find((n) => n.id === notificationId);
      if (deleted && !deleted.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      apiClient.showToast('Failed to delete notification', 'error');
    }
  };

  const handleNavigate = (projectId) => {
    // Navigate to project or open in DAW
    window.location.href = `/daw?project=${projectId}`;
  };

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      loadNotifications(currentPage + 1, true);
    }
  }, [currentPage, hasNextPage, isFetchingNextPage, loadNotifications]);

  // Infinite scroll
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    const lastItem = scrollContainerRef.current?.lastElementChild;
    if (lastItem) {
      observer.observe(lastItem);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasNextPage, isFetchingNextPage, handleLoadMore, notifications.length]);

  if (error) {
    return (
      <div className="notifications-view">
        <div className="notifications-view__error">
          <AlertCircle size={24} />
          <p>Failed to load notifications</p>
          <button 
            onClick={() => loadNotifications(1, false)} 
            className="notifications-view__retry-btn"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-view">
      {/* Header */}
      <div className="notifications-view__header">
        <div className="notifications-view__header-left">
          <Bell size={20} />
          <h2>Notifications</h2>
          {unreadCount > 0 && (
            <span className="notifications-view__badge">{unreadCount}</span>
          )}
        </div>
        <div className="notifications-view__header-actions">
          {unreadCount > 0 && (
            <button
              className="notifications-view__action-btn"
              onClick={handleMarkAllRead}
              title="Mark all as read"
            >
              <Check size={16} />
              <span>Mark all read</span>
            </button>
          )}
          <button
            className="notifications-view__action-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="notifications-view__filters">
        <button
          className={`notifications-view__filter-btn ${filters.unreadOnly ? 'active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, unreadOnly: !prev.unreadOnly }))}
        >
          <Filter size={16} />
          <span>Unread only</span>
        </button>
        <select
          className="notifications-view__type-filter"
          value={filters.type || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value || null }))}
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="notifications-view__content" ref={scrollContainerRef}>
        {isLoading && notifications.length === 0 ? (
          <div className="notifications-view__loading">
            <Loader2 size={24} className="animate-spin" />
            <span>Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-view__empty">
            <Bell size={48} />
            <p>No notifications</p>
            {filters.unreadOnly && (
              <button
                className="notifications-view__clear-filter-btn"
                onClick={() => setFilters((prev) => ({ ...prev, unreadOnly: false }))}
              >
                Show all notifications
              </button>
            )}
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
                onNavigate={handleNavigate}
              />
            ))}
            {isFetchingNextPage && (
              <div className="notifications-view__loading-more">
                <Loader2 size={20} className="animate-spin" />
                <span>Loading more...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
