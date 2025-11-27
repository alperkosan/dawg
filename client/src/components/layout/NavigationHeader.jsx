/**
 * Navigation Header
 * Top navigation bar for switching between Media and DAW
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import QuickAuthModal from '../common/QuickAuthModal';
import ProjectSelector from '../common/ProjectSelector';
import { Home, LogOut, User, Music, Settings, FolderOpen, Edit2 } from 'lucide-react';
import DawgLogo from '../common/DawgLogo';
import './NavigationHeader.css';

export default function NavigationHeader({ currentProjectId, currentProjectTitle, onProjectSelect, onNewProject, onEditTitle }) {
  const location = useLocation();
  const { isAuthenticated, user, isGuest } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    sessionStorage.removeItem('user-has-chosen');
    window.location.href = '/';
  };

  const handleAuthSuccess = () => {
    // User is now authenticated, modal will close
    // State is updated automatically by authService
    setShowAuthModal(false);
  };

  return (
    <nav className="navigation-header">
      <div className="navigation-header__container">
        <div className="navigation-header__brand">
          <Link to="/" className="navigation-header__logo">
            <DawgLogo size={36} variant="icon" />
            <span>DAWG</span>
          </Link>
        </div>

        <div className="navigation-header__links">
          <Link
            to="/media"
            className={`navigation-header__link ${location.pathname.startsWith('/media') ? 'active' : ''}`}
          >
            <Home size={18} />
            <span>Medya</span>
          </Link>
          <Link
            to="/daw"
            className={`navigation-header__link ${location.pathname.startsWith('/daw') ? 'active' : ''}`}
          >
            <Music size={18} />
            <span>DAW</span>
          </Link>
          {isAuthenticated && !isGuest && (
            <>
              <Link
                to="/projects"
                className={`navigation-header__link ${location.pathname.startsWith('/projects') ? 'active' : ''}`}
              >
                <FolderOpen size={18} />
                <span>Projects</span>
              </Link>
              <Link
                to="/admin"
                className={`navigation-header__link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
              >
                <Settings size={18} />
                <span>Admin</span>
              </Link>
            </>
          )}
          
          {/* Project Selector and Title - Only show in DAW */}
          {location.pathname.startsWith('/daw') && isAuthenticated && !isGuest && (
            <>
              {currentProjectTitle && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📝 Edit title button clicked');
                    onEditTitle?.();
                  }}
                  className="navigation-header__project-title"
                  title="Click to edit project title"
                  type="button"
                >
                  <span>{currentProjectTitle}</span>
                  <Edit2 size={14} />
                </button>
              )}
              <ProjectSelector
                currentProjectId={currentProjectId}
                onProjectSelect={onProjectSelect}
                onNewProject={onNewProject}
              />
            </>
          )}
        </div>

        <div className="navigation-header__user">
          {isAuthenticated ? (
            <>
              <div className="navigation-header__user-info">
                <User size={18} />
                <span>{user?.displayName || user?.username || 'User'}</span>
              </div>
              <button
                className="navigation-header__logout"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : isGuest ? (
            <button
              onClick={() => setShowAuthModal(true)}
              className="navigation-header__auth-link"
            >
              Giriş Yap
            </button>
          ) : null}
        </div>
      </div>
      <QuickAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </nav>
  );
}

