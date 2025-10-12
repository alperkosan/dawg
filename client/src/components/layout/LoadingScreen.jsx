import React from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import './LoadingScreen.css';

const LoadingScreen = () => {
  const getActiveTheme = useThemeStore(state => state.getActiveTheme);
  const theme = getActiveTheme();

  const style = {
    '--bg-primary': theme.zenith['bg-primary'],
    '--bg-secondary': theme.zenith['bg-secondary'],
    '--bg-tertiary': theme.zenith['bg-tertiary'],
    '--text-primary': theme.zenith['text-primary'],
    '--text-secondary': theme.zenith['text-secondary'],
    '--accent-cool': theme.zenith['accent-cool'],
  };

  const zenithText = "ZENITH";

  return (
    <div style={style} className="w-screen h-screen flex flex-col items-center justify-center text-[var(--text-primary)] font-mono loading-screen-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-widest mb-4">
          {zenithText.split('').map((letter, index) => (
            <span 
              key={index} 
              className="zenith-letter"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {letter}
            </span>
          ))}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Initializing Audio Engine & Loading Worklets...
        </p>
      </div>
      <div className="loading-bar-container">
        <div className="loading-bar"></div>
      </div>
    </div>
  );
};

export default LoadingScreen;