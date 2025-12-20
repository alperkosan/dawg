/**
 * useMediaWebSocket - Real-time updates for Media Panel
 * 
 * Handles WebSocket connection for live updates:
 * - Like count changes
 * - New comments
 * - New notifications
 * - Project updates
 */

import { useEffect, useCallback, useRef, useState } from 'react';

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_ATTEMPTS = 5;

// Event types from server
export const WS_EVENTS = {
  PROJECT_LIKED: 'project:liked',
  PROJECT_UNLIKED: 'project:unliked',
  PROJECT_COMMENTED: 'project:commented',
  PROJECT_SHARED: 'project:shared',
  PROJECT_REMIXED: 'project:remixed',
  NOTIFICATION_NEW: 'notification:new',
  USER_FOLLOWED: 'user:followed',
  USER_UNFOLLOWED: 'user:unfollowed',
};

/**
 * Custom hook for WebSocket connection
 */
export function useMediaWebSocket(options = {}) {
  const {
    onProjectLiked,
    onProjectUnliked,
    onProjectCommented,
    onProjectShared,
    onNotification,
    onUserFollowed,
    enabled = true,
  } = options;

  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Get WebSocket URL
  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/media`;
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      const { type, payload } = data;

      switch (type) {
        case WS_EVENTS.PROJECT_LIKED:
          onProjectLiked?.(payload);
          break;
        case WS_EVENTS.PROJECT_UNLIKED:
          onProjectUnliked?.(payload);
          break;
        case WS_EVENTS.PROJECT_COMMENTED:
          onProjectCommented?.(payload);
          break;
        case WS_EVENTS.PROJECT_SHARED:
          onProjectShared?.(payload);
          break;
        case WS_EVENTS.NOTIFICATION_NEW:
          onNotification?.(payload);
          break;
        case WS_EVENTS.USER_FOLLOWED:
        case WS_EVENTS.USER_UNFOLLOWED:
          onUserFollowed?.(payload);
          break;
        default:
          console.log('Unknown WS event:', type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [onProjectLiked, onProjectUnliked, onProjectCommented, onProjectShared, onNotification, onUserFollowed]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const url = getWsUrl();
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('🔌 Media WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = handleMessage;

      wsRef.current.onclose = (event) => {
        console.log('🔌 Media WebSocket closed:', event.code, event.reason);
        setIsConnected(false);

        // Attempt reconnection
        if (enabled && reconnectAttempts.current < WS_MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          reconnectTimeout.current = setTimeout(() => {
            console.log(`🔌 Reconnecting... (attempt ${reconnectAttempts.current})`);
            connect();
          }, WS_RECONNECT_DELAY);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('🔌 Media WebSocket error:', error);
        setConnectionError(error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionError(error);
    }
  }, [enabled, getWsUrl, handleMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Send message through WebSocket
  const send = useCallback((type, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  // Subscribe to specific project updates
  const subscribeToProject = useCallback((projectId) => {
    send('subscribe:project', { projectId });
  }, [send]);

  // Unsubscribe from project updates
  const unsubscribeFromProject = useCallback((projectId) => {
    send('unsubscribe:project', { projectId });
  }, [send]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    connectionError,
    send,
    subscribeToProject,
    unsubscribeFromProject,
    reconnect: connect,
  };
}

export default useMediaWebSocket;

