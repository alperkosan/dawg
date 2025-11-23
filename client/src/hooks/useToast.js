/**
 * Toast Notification Hook
 * Global toast notification system for showing success/error/info messages
 */

import { useState, useCallback, createContext, useContext } from 'react';
import { flushSync } from 'react-dom';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [toastKey, setToastKey] = useState(0); // ✅ FIX: Force re-render with key

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    // ✅ FIX: Serialize/deserialize toast to ensure React detects state change
    const serializedToast = JSON.parse(JSON.stringify(toast));
    
    // ✅ FIX: Use queueMicrotask to defer flushSync if called during render
    // This prevents "flushSync was called from inside a lifecycle method" warning
    queueMicrotask(() => {
      try {
        flushSync(() => {
          setToasts(prev => {
            const newToasts = [...prev];
            newToasts.push(serializedToast);
            return newToasts;
          });
          setToastKey(prev => prev + 1);
        });
      } catch (error) {
        // Fallback: If flushSync fails (e.g., during render), use regular state update
        setToasts(prev => {
          const newToasts = [...prev];
          newToasts.push(serializedToast);
          return newToasts;
        });
        setToastKey(prev => prev + 1);
      }
    });
    
    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message, duration) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message, duration) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const showInfo = useCallback((message, duration) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  const showWarning = useCallback((message, duration) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, showSuccess, showError, showInfo, showWarning, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback: return no-op functions if not in provider
    return {
      toasts: [],
      showToast: () => {},
      showSuccess: () => {},
      showError: () => {},
      showInfo: () => {},
      showWarning: () => {},
      removeToast: () => {},
    };
  }
  return context;
}



