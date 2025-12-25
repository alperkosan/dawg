/**
 * Quick Auth Modal
 * In-app authentication without route change
 * Opens as modal overlay in DAW
 */

import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import { X, Mail, Lock, User, LogIn } from 'lucide-react';
import './QuickAuthModal.css';

export default function QuickAuthModal({ isOpen, onClose, onSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    displayName: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { error: storeError } = useAuthStore();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (mode === 'register') {
      if (!formData.email) newErrors.email = 'Email gereklidir';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Geçerli bir email giriniz';

      if (!formData.username) newErrors.username = 'Kullanıcı adı gereklidir';
      else if (formData.username.length < 3) newErrors.username = 'Kullanıcı adı en az 3 karakter olmalıdır';

      if (!formData.displayName) newErrors.displayName = 'İsim gereklidir';

      if (!formData.password) newErrors.password = 'Şifre gereklidir';
      else if (formData.password.length < 6) newErrors.password = 'Şifre en az 6 karakter olmalıdır';
    } else {
      if (!formData.email) newErrors.email = 'Email gereklidir';
      if (!formData.password) newErrors.password = 'Şifre gereklidir';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      if (mode === 'register') {
        await authService.register(formData);
      } else {
        await authService.login(formData.email, formData.password);
      }

      // Success - update session storage
      sessionStorage.setItem('user-has-chosen', JSON.stringify(true));

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();

      // Reset form
      setFormData({
        email: '',
        username: '',
        password: '',
        displayName: '',
      });
    } catch (error) {
      setErrors({ submit: error.message || 'Bir hata oluştu' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="quick-auth-modal-overlay" onClick={onClose}>
      <div className="quick-auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="quick-auth-modal__header">
          <div className="quick-auth-modal__header-content">
            <div className="quick-auth-modal__icon-wrapper">
              {mode === 'login' ? <LogIn size={24} /> : <User size={24} />}
            </div>
            <h2 className="quick-auth-modal__title">
              {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </h2>
          </div>
          <button
            className="quick-auth-modal__close"
            onClick={onClose}
            aria-label="Kapat"
          >
            <X size={20} />
          </button>
        </div>

        <div className="quick-auth-modal__tabs">
          <button
            className={`quick-auth-modal__tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setErrors({});
            }}
          >
            <LogIn size={18} />
            Giriş Yap
          </button>
          <button
            className={`quick-auth-modal__tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setErrors({});
            }}
          >
            <User size={18} />
            Kayıt Ol
          </button>
        </div>

        <form className="quick-auth-modal__form" onSubmit={handleSubmit} autoComplete="off">
          <div className="quick-auth-modal__field">
            <label className="quick-auth-modal__label">
              <Mail size={16} />
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`quick-auth-modal__input ${errors.email ? 'error' : ''}`}
              placeholder="ornek@email.com"
              disabled={isLoading}
              autoComplete="off"
            />
            {errors.email && (
              <span className="quick-auth-modal__error">{errors.email}</span>
            )}
          </div>

          {mode === 'register' && (
            <>
              <div className="quick-auth-modal__field">
                <label className="quick-auth-modal__label">
                  <User size={16} />
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={`quick-auth-modal__input ${errors.username ? 'error' : ''}`}
                  placeholder="kullaniciadi"
                  disabled={isLoading}
                  autoComplete="off"
                />
                {errors.username && (
                  <span className="quick-auth-modal__error">{errors.username}</span>
                )}
              </div>

              <div className="quick-auth-modal__field">
                <label className="quick-auth-modal__label">
                  <User size={16} />
                  İsim
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  className={`quick-auth-modal__input ${errors.displayName ? 'error' : ''}`}
                  placeholder="Adınız Soyadınız"
                  disabled={isLoading}
                  autoComplete="off"
                />
                {errors.displayName && (
                  <span className="quick-auth-modal__error">{errors.displayName}</span>
                )}
              </div>
            </>
          )}

          <div className="quick-auth-modal__field">
            <label className="quick-auth-modal__label">
              <Lock size={16} />
              Şifre
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`quick-auth-modal__input ${errors.password ? 'error' : ''}`}
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            {errors.password && (
              <span className="quick-auth-modal__error">{errors.password}</span>
            )}
          </div>

          {(errors.submit || storeError) && (
            <div className="quick-auth-modal__error-message">
              {errors.submit || storeError}
            </div>
          )}

          <button
            type="submit"
            className="quick-auth-modal__submit"
            disabled={isLoading}
          >
            {isLoading ? 'İşleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </form>
      </div>
    </div>
  );
}

