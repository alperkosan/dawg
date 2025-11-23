/**
 * Guest Banner
 * Shows when user is in guest mode
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import QuickAuthModal from './QuickAuthModal';
import { X, LogIn } from 'lucide-react';
import './GuestBanner.css';

export default function GuestBanner({ onHeightChange }) {
  const navigate = useNavigate();
  const { isGuest } = useAuthStore();
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      const stored = localStorage.getItem('guest-banner-dismissed');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const bannerRef = React.useRef(null);

  // Hide banner if user becomes authenticated
  React.useEffect(() => {
    if (!isGuest) {
      setDismissed(true);
    }
  }, [isGuest]);

  // Notify parent of banner height changes
  React.useEffect(() => {
    if (onHeightChange && bannerRef.current) {
      const height = bannerRef.current.offsetHeight;
      onHeightChange(height);
      
      // Update on resize
      const resizeObserver = new ResizeObserver(() => {
        if (bannerRef.current) {
          onHeightChange(bannerRef.current.offsetHeight);
        }
      });
      
      resizeObserver.observe(bannerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [onHeightChange, isGuest, dismissed]);

  if (!isGuest || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('guest-banner-dismissed', JSON.stringify(true));
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setDismissed(true);
  };

  return (
    <div className="guest-banner" ref={bannerRef}>
      <div className="guest-banner__content">
        <div className="guest-banner__message">
          <span>Misafir modundasınız. Projelerinizi kaydetmek için </span>
          <button
            className="guest-banner__link"
            onClick={() => setShowAuthModal(true)}
          >
            giriş yapın
          </button>
          <span> veya </span>
          <button
            className="guest-banner__link"
            onClick={() => setShowAuthModal(true)}
          >
            kayıt olun
          </button>
        </div>
        <div className="guest-banner__actions">
          <button
            className="guest-banner__button"
            onClick={() => setShowAuthModal(true)}
          >
            <LogIn size={16} />
            Giriş Yap
          </button>
          <button
            className="guest-banner__dismiss"
            onClick={handleDismiss}
            title="Kapat"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <QuickAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
