/**
 * Welcome Screen
 * Shows after login - user chooses between Media and DAW
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import { Music, Home, LogOut } from 'lucide-react';
import DawgLogo from './DawgLogo';
import './WelcomeScreen.css';

export default function WelcomeScreen({ onChoose }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleChoose = (path) => {
    sessionStorage.setItem('user-has-chosen', 'true');
    // ✅ FIX: Call onChoose callback to update parent state
    if (onChoose) {
      onChoose();
    }
    navigate(path);
  };

  const handleLogout = async () => {
    await authService.logout();
    sessionStorage.removeItem('user-has-chosen');
    navigate('/auth');
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-container">
        <div className="welcome-header">
          <DawgLogo size={56} variant="full" />
          <h1 className="welcome-title">Hoş Geldin, {user?.displayName || user?.username || 'Kullanıcı'}!</h1>
          <p className="welcome-subtitle">Ne yapmak istersin?</p>
        </div>

        <div className="welcome-options">
          <button
            className="welcome-option"
            onClick={() => handleChoose('/media')}
          >
            <div className="welcome-option__icon">
              <Home size={48} />
            </div>
            <h2 className="welcome-option__title">Medya</h2>
            <p className="welcome-option__description">
              Keşfet, ilham al, paylaş. Top 10 listelerini gör, 
              beatmaker ve MC'leri bul, projeleri remix et.
            </p>
          </button>

          <button
            className="welcome-option"
            onClick={() => handleChoose('/daw')}
          >
            <div className="welcome-option__icon">
              <Music size={48} />
            </div>
            <h2 className="welcome-option__title">DAW</h2>
            <p className="welcome-option__description">
              Stüdyoya gir, beat yap, projelerini kaydet. 
              Real-time collaboration ile birlikte çalış.
            </p>
          </button>
        </div>

        <div className="welcome-footer">
          <button
            className="welcome-logout"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}

