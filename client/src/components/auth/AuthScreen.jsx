/**
 * Authentication Screen
 * Login and Register UI
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import DawgLogo from '../common/DawgLogo';
import './AuthScreen.css';

export default function AuthScreen({ onSuccess, onGuest }) {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') || 'login';
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    displayName: '',
  });
  const [errors, setErrors] = useState({});

  const { isLoading, error } = useAuthStore();

  // Update mode when URL param changes
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode && (urlMode === 'login' || urlMode === 'register')) {
      setMode(urlMode);
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (mode === 'register') {
      if (!formData.username) {
        newErrors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        newErrors.username = 'Username can only contain letters, numbers, and underscores';
      }

      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
        newErrors.password = 'Password must contain uppercase, lowercase, and number';
      }
    } else {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      if (mode === 'register') {
        await authService.register({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          displayName: formData.displayName || formData.username,
        });
      } else {
        await authService.login(formData.email, formData.password);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Error is handled by store
      console.error('Auth error:', error);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          <DawgLogo size={48} variant="full" />
          <h1 className="auth-logo">DAWG</h1>
          <p className="auth-tagline">Create. Collaborate. Share.</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Giriş Yap
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            Kayıt Ol
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          {mode === 'register' && (
            <>
              <div className="form-group">
                <label htmlFor="username">Kullanıcı Adı</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="username"
                  className={errors.username ? 'error' : ''}
                />
                {errors.username && <span className="error-message">{errors.username}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="displayName">Görünen Ad (Opsiyonel)</label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={handleChange}
                  placeholder="Display Name"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={errors.password ? 'error' : ''}
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={isLoading}
          >
            {isLoading ? 'Yükleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="auth-divider">
          <span>veya</span>
        </div>

        <button
          className="auth-guest"
          onClick={onGuest}
          disabled={isLoading}
        >
          Misafir Olarak Devam Et
        </button>

        {mode === 'login' && (
          <p className="auth-hint">
            Hesabınız yok mu?{' '}
            <button
              className="auth-link"
              onClick={() => setMode('register')}
            >
              Kayıt Ol
            </button>
          </p>
        )}

        {mode === 'register' && (
          <p className="auth-hint">
            Zaten hesabınız var mı?{' '}
            <button
              className="auth-link"
              onClick={() => setMode('login')}
            >
              Giriş Yap
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

