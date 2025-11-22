/**
 * Toast Notification Component
 * Displays temporary success/error/info messages
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertCircle, X } from 'lucide-react';
import './Toast.css';

export function Toast({ message, type = 'info', duration = 4000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
    warning: AlertCircle,
  };

  const Icon = icons[type] || Info;

  return (
    <div className={`toast toast--${type} ${isVisible ? 'toast--visible' : ''}`}>
      <Icon size={20} className="toast__icon" />
      <span className="toast__message">{message}</span>
      <button className="toast__close" onClick={() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
      }}>
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration || 4000}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

