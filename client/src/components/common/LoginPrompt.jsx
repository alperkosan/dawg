/**
 * Login Prompt Modal
 * Shown when guest user tries to save
 * Now uses QuickAuthModal for in-app authentication
 */

import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import QuickAuthModal from './QuickAuthModal';
import './LoginPrompt.css';

export default function LoginPrompt({ isOpen, onClose, onLogin }) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated } = useAuthStore();

  // If user becomes authenticated, close both modals
  React.useEffect(() => {
    if (isAuthenticated && showAuthModal) {
      setShowAuthModal(false);
      onClose();
      if (onLogin) {
        onLogin();
      }
    }
  }, [isAuthenticated, showAuthModal, onClose, onLogin]);

  if (!isOpen) return null;

  const handleLoginClick = () => {
    setShowAuthModal(true);
  };

  const handleRegisterClick = () => {
    setShowAuthModal(true);
    // QuickAuthModal will handle mode switching
  };

  return (
    <>
      <div className="login-prompt-overlay" onClick={onClose}>
        <div className="login-prompt-modal" onClick={(e) => e.stopPropagation()}>
          <div className="login-prompt-header">
            <h2>Giriş Yapmanız Gerekiyor</h2>
            <button className="login-prompt-close" onClick={onClose}>×</button>
          </div>

          <div className="login-prompt-content">
            <p>
              Projelerinizi kaydetmek, paylaşmak ve diğer özellikleri kullanmak için
              giriş yapmanız veya kayıt olmanız gerekiyor.
            </p>

            <div className="login-prompt-actions">
              <button className="login-prompt-button primary" onClick={handleLoginClick}>
                Giriş Yap
              </button>
              <button className="login-prompt-button secondary" onClick={handleRegisterClick}>
                Kayıt Ol
              </button>
              <button className="login-prompt-button ghost" onClick={onClose}>
                İptal
              </button>
            </div>
          </div>
        </div>
      </div>

      <QuickAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          onClose();
          if (onLogin) {
            onLogin();
          }
        }}
      />
    </>
  );
}
