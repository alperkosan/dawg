/**
 * Confirmation Modal Component
 * Reusable confirmation dialog to replace native confirm()
 */

import React from 'react';
import { createPortal } from 'react-dom';
import './ConfirmationModal.css';

export default function ConfirmationModal({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default', // 'default', 'danger', 'warning'
}) {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel?.();
    }
  };

  // ✅ FIX: Use Portal to render outside stacking context (fixes centering issues)
  return createPortal(
    <div className="confirmation-modal-overlay" onClick={handleOverlayClick}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirmation-modal__header">
          <h2 className="confirmation-modal__title">{title}</h2>
        </div>
        <div className="confirmation-modal__body">
          {/* ✅ FIX: Use div instead of p to allow block content (nested divs/uls) */}
          <div className="confirmation-modal__message">{message}</div>
        </div>
        <div className="confirmation-modal__actions">
          <button
            type="button"
            className="confirmation-modal__button confirmation-modal__button--cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirmation-modal__button confirmation-modal__button--confirm confirmation-modal__button--${variant}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

