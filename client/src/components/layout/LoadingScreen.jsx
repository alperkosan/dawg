
import React from 'react';
import { useThemeStore } from '../../store/useThemeStore';

const LoadingScreen = () => {
  const getActiveTheme = useThemeStore(state => state.getActiveTheme);
  const theme = getActiveTheme();

  const style = {
    '--bg-primary': theme.zenith['bg-primary'],
    '--text-primary': theme.zenith['text-primary'],
    '--accent-cool': theme.zenith['accent-cool'],
  };

  return (
    <div style={style} className="w-screen h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono">
      <div className="flex items-center justify-center space-x-4">
        <div 
          className="w-8 h-8 border-4 border-t-4 border-t-[var(--accent-cool)] border-[rgba(255,255,255,0.2)] rounded-full animate-spin"
          style={{ borderTopColor: 'var(--accent-cool)' }}
        ></div>
        <h1 className="text-2xl font-bold tracking-wider">ZENITH</h1>
      </div>
      <p className="mt-4 text-sm text-center text-[var(--text-secondary)]">
        Initializing Audio Engine & Loading Worklets...
      </p>
    </div>
  );
};

export default LoadingScreen;
