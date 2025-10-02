// hooks/useGlobalPlayhead.js
// ✅ UPDATED: Now uses unified playback system instead of old AudioContextService
import { usePlaybackPosition } from './usePlaybackControls';

export const useGlobalPlayhead = () => {
  // ✅ Use unified playback system
  const { position, isPlaying, isReady } = usePlaybackPosition();

  // Map to legacy format for backward compatibility
  const playbackState = isPlaying ? 'playing' : 'stopped';
  const currentStep = position || 0;

  console.log('🎯 useGlobalPlayhead:', { currentStep, playbackState, position, isPlaying });

  return {
    currentStep,
    playbackState
  };
};