// hooks/usePlaybackControls.js
import { useState, useEffect, useCallback } from 'react';
import { AudioContextService } from '@/lib/services/AudioContextService.js';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal.js';
import { PlaybackEngine } from '@/lib/core/PlaybackEngine.js';

/**
 * 🎵 UNIFIED PLAYBACK CONTROLS HOOK
 *
 * Tek hook tüm UI component'ler için:
 * - Temiz API
 * - Tek state source
 * - Consistent behavior
 * - Error handling
 */

// Singleton engine instance
let globalPlaybackEngine = null;

// Engine factory
const getPlaybackEngine = async () => {
  if (globalPlaybackEngine) {
    return globalPlaybackEngine;
  }

  try {
    const audioEngine = AudioEngineGlobal.get();
    if (!audioEngine) {
      console.warn('🎵 Audio engine not available');
      return null;
    }

    globalPlaybackEngine = new PlaybackEngine(audioEngine);
    console.log('🎵 PlaybackEngine singleton created');
    return globalPlaybackEngine;
  } catch (error) {
    console.error('🎵 Failed to create PlaybackEngine:', error);
    return null;
  }
};

/**
 * ✅ MAIN HOOK - All components use this
 */
export const usePlaybackControls = (options = {}) => {
  const {
    trackPosition = true,
    trackGhost = false
  } = options;

  // Single state from engine
  const [state, setState] = useState({
    isPlaying: false,
    playbackState: 'stopped',
    currentPosition: 0,
    bpm: 140,
    loopEnabled: true,
    loopStart: 0,
    loopEnd: 64,
    ghostPosition: null,
    isUserScrubbing: false,
    isReady: false
  });

  // Initialize engine and subscribe
  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const initEngine = async () => {
      try {
        const engine = await getPlaybackEngine();
        if (!engine || !isMounted) return;

        // Subscribe to all events
        unsubscribe = engine.subscribe((event) => {
          if (!isMounted) return;

          if (event.type === 'state-change') {
            setState(prev => ({
              ...prev,
              ...event.state,
              isReady: true
            }));
          } else if (event.type === 'position-update' && trackPosition) {
            setState(prev => ({
              ...prev,
              currentPosition: event.position
            }));
          } else if (event.type === 'ghost-position-change' && trackGhost) {
            setState(prev => ({
              ...prev,
              ghostPosition: event.ghostPosition
            }));
          }
        });

        console.log('🎵 usePlaybackControls initialized');
      } catch (error) {
        console.error('🎵 Failed to initialize playback controls:', error);
      }
    };

    initEngine();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [trackPosition, trackGhost]);

  // =================== ACTIONS ===================

  const actions = useCallback(() => {
    return {
      // Primary controls
      play: async (startPosition = null) => {
        const engine = await getPlaybackEngine();
        return engine?.play(startPosition) || false;
      },

      pause: async () => {
        const engine = await getPlaybackEngine();
        return engine?.pause() || false;
      },

      stop: async () => {
        const engine = await getPlaybackEngine();
        return engine?.stop() || false;
      },

      togglePlayPause: async () => {
        const engine = await getPlaybackEngine();
        return engine?.togglePlayPause() || false;
      },

      // Position control
      jumpToPosition: async (position, options = {}) => {
        const engine = await getPlaybackEngine();
        return engine?.jumpToPosition(position, options);
      },

      // Ghost playhead
      setGhostPosition: async (position) => {
        const engine = await getPlaybackEngine();
        engine?.setGhostPosition(position);
      },

      clearGhostPosition: async () => {
        const engine = await getPlaybackEngine();
        engine?.clearGhostPosition();
      },

      // Settings
      setBPM: async (bpm) => {
        const engine = await getPlaybackEngine();
        engine?.setBPM(bpm);
      },

      setLoopRange: async (start, end) => {
        const engine = await getPlaybackEngine();
        engine?.setLoopRange(start, end);
      },

      setLoopEnabled: async (enabled) => {
        const engine = await getPlaybackEngine();
        engine?.setLoopEnabled(enabled);
      }
    };
  }, []);

  return {
    // State
    ...state,

    // Actions
    ...actions(),

    // Utilities
    isReady: state.isReady
  };
};

/**
 * ✅ LIGHTWEIGHT HOOK - Only position tracking
 */
export const usePlaybackPosition = () => {
  const { currentPosition, isPlaying, isReady } = usePlaybackControls({
    trackPosition: true,
    trackGhost: false
  });

  return { position: currentPosition, isPlaying, isReady };
};

/**
 * ✅ TIMELINE INTERACTION HOOK - For timeline components
 */
export const useTimelineInteraction = (stepWidth = 16) => {
  const { jumpToPosition, setGhostPosition, clearGhostPosition } = usePlaybackControls({
    trackGhost: true
  });

  const handleTimelineClick = useCallback(async (e, audioLoopLength) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetStep = Math.max(0, Math.min(audioLoopLength - 1, Math.round(clickX / stepWidth)));

    await jumpToPosition(targetStep, { smooth: true });
  }, [jumpToPosition, stepWidth]);

  const handleTimelineHover = useCallback(async (e, audioLoopLength) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const hoverStep = Math.max(0, Math.min(audioLoopLength - 1, Math.round(hoverX / stepWidth)));

    await setGhostPosition(hoverStep);
  }, [setGhostPosition, stepWidth]);

  const handleTimelineLeave = useCallback(async () => {
    await clearGhostPosition();
  }, [clearGhostPosition]);

  return {
    handleTimelineClick,
    handleTimelineHover,
    handleTimelineLeave
  };
};

/**
 * ✅ TRANSPORT CONTROLS HOOK - For transport UI
 */
export const useTransportControls = () => {
  const {
    isPlaying,
    playbackState,
    bpm,
    loopEnabled,
    play,
    pause,
    stop,
    togglePlayPause,
    setBPM,
    setLoopEnabled,
    isReady
  } = usePlaybackControls();

  return {
    // State
    isPlaying,
    playbackState,
    bpm,
    loopEnabled,
    isReady,

    // Actions
    play,
    pause,
    stop,
    togglePlayPause,
    setBPM,
    setLoopEnabled
  };
};