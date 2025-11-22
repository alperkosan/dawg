/**
 * Project Loading Screen
 * Shows during project loading/switching
 */

import React from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import DawgLogo from './DawgLogo';
import { Loader2, FolderOpen } from 'lucide-react';
import './ProjectLoadingScreen.css';

export default function ProjectLoadingScreen({ projectTitle = null, message = null }) {
  const getActiveTheme = useThemeStore(state => state.getActiveTheme);
  const theme = getActiveTheme();

  const style = {
    '--bg-primary': theme.zenith['bg-primary'],
    '--bg-secondary': theme.zenith['bg-secondary'],
    '--bg-tertiary': theme.zenith['bg-tertiary'],
    '--text-primary': theme.zenith['text-primary'],
    '--text-secondary': theme.zenith['text-secondary'],
    '--accent-cool': theme.zenith['accent-cool'],
    '--accent-warm': theme.zenith['accent-warm'],
  };

  return (
    <div style={style} className="project-loading-screen">
      <div className="project-loading-screen__content">
        <div className="project-loading-screen__logo">
          <DawgLogo size={64} variant="full" />
        </div>
        
        <div className="project-loading-screen__icon">
          <FolderOpen size={32} />
        </div>
        
        <h2 className="project-loading-screen__title">
          {projectTitle ? `Yükleniyor: ${projectTitle}` : 'Proje Yükleniyor'}
        </h2>
        
        <p className="project-loading-screen__message">
          {message || 'Proje verileri yükleniyor, lütfen bekleyin...'}
        </p>
        
        <div className="project-loading-screen__spinner">
          <Loader2 size={24} className="spinning" />
        </div>
        
        <div className="project-loading-screen__steps">
          <div className="project-loading-screen__step">
            <span className="step-indicator"></span>
            <span>Proje verileri temizleniyor</span>
          </div>
          <div className="project-loading-screen__step">
            <span className="step-indicator"></span>
            <span>Enstrümanlar yükleniyor</span>
          </div>
          <div className="project-loading-screen__step">
            <span className="step-indicator"></span>
            <span>Pattern'ler ve notalar yükleniyor</span>
          </div>
          <div className="project-loading-screen__step">
            <span className="step-indicator"></span>
            <span>Mixer kanalları yükleniyor</span>
          </div>
        </div>
      </div>
    </div>
  );
}



